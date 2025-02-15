import * as vscode from "vscode";
import { findSubtitle, getData, ParseError, parseSubtitles, SrtEditorData } from "./get_subs";
import { makeDurFullMS, makeDurMS, Subtitle, to_ms } from "./subtitle";

function p(line: number, col: number): vscode.Position {
    return new vscode.Position(line, col);
}

function r(start: vscode.Position, end: vscode.Position): vscode.Range {
    return new vscode.Range(start, end);
}

function lineRange(start: number, end: number): vscode.Range {
    return r(p(start, 0), p(end, 0));
}

function lineRangeN(editor: vscode.TextEditor, start: number, end: number): vscode.Range {
    const endLineLength = editor.document.lineAt(end - 1).text.length;
    return r(p(start, 0), p(end - 1, endLineLength));
}

function addToIndices(lines: string[], subs: Subtitle[], start: number, n: number) {
    const offset = subs[start].line_pos;
    for (let i = start; i < subs.length; i++) {
        const sub = subs[i];
        lines[sub.line_pos - offset] = (sub.index + n).toString();
    }
    return lines;
}

function defineCommand(name: string, func: (data: SrtEditorData) => void): vscode.Disposable {
    return vscode.commands.registerCommand(`srt-subrip.${name}`, () => {
        const data = getData();
        if (data) {
            func(data);
        }
    });
}

function defineCommandSubs(
    name: string,
    func: (data: SrtEditorData, subs: Subtitle[]) => void): vscode.Disposable {
    return vscode.commands.registerCommand(`srt-subrip.${name}`, () => {
        const data = getData();
        if (data == null) return;
        const parseResult = parseSubtitles(data.lines);
        if (parseResult instanceof ParseError) {
            console.error(parseResult);
            return;
        }
        if (data) {
            func(data, parseResult);
        }
    });
}

function defineCommandSubtitle(
    name: string,
    func: (data: SrtEditorData, subs: Subtitle[], sub_i: number) => void): vscode.Disposable {
    return vscode.commands.registerCommand(`srt-subrip.${name}`, () => {
        const data = getData();
        if (data == null) return;
        const parseResult = parseSubtitles(data.lines);
        if (parseResult instanceof ParseError) {
            console.error(parseResult);
            return;
        }
        const sub_i = findSubtitle(parseResult, data.line);
        if (sub_i == null) {
            vscode.window.showWarningMessage("Not in a subtitle");
            return;
        }
        if (data) {
            func(data, parseResult, sub_i);
        }
    });
}

function echoCurrentSubtitle(data: SrtEditorData, subs: Subtitle[], sub_i: number) {
    vscode.window.showWarningMessage(`On line number ${data.line}`);
}

function subMerge(lines: string[], subs: Subtitle[], sub_i: number): string[] {
    const ind_lines = lines.splice(subs[sub_i + 1].line_pos);
    const new_lines = addToIndices(ind_lines, subs, sub_i + 1, - 1);
    const reindexed = lines.concat(new_lines);

    const sub = subs[sub_i];
    const next = subs[sub_i + 1];
    const del_from = next.line_pos - 1;
    reindexed.splice(del_from, 3);

    const dur_line = makeDurFullMS(sub.start_ms, next.end_ms);
    reindexed[sub.line_pos + 1] = dur_line;
    return reindexed;
}

function srtMerge(data: SrtEditorData, subs: Subtitle[]) {
    const sub_first = findSubtitle(subs, data.line);
    if (sub_first == null) {
        vscode.window.showErrorMessage("Not in a subtitle");
        return;
    }
    if (sub_first == subs.length - 1) {
        vscode.window.showErrorMessage("Can't merge the last subtitle");
        return;
    }

    let sub_last = findSubtitle(subs, data.endLine);
    if (sub_last == null) {
        vscode.window.showErrorMessage("Can't find last subtitle");
        return;
    }
    if (sub_last == sub_first) {
        sub_last++;
    }

    let newLines = data.lines;

    for (let i = sub_first; i < sub_last; i++) {
        const result = parseSubtitles(newLines);
        if (result instanceof ParseError) {
            vscode.window.showErrorMessage(
                `Unexpected error on line ${result.line}: ${result.error}`);
            return;
        }
        newLines = subMerge(newLines, result, sub_first);
    }
    data.editor.edit(editBuilder => {
        editBuilder.replace(
            lineRangeN(data.editor, 0, data.editor.document.lineCount), newLines.join('\n'));
    });
}

type SplitMode = "length" | "half" | "ask";

async function srtSplit(data: SrtEditorData, subs: Subtitle[], sub_i: number) {
    let lines = data.lines.slice();
    const config = vscode.workspace.getConfiguration("srt-subrip");
    const minPause = config.get("minPause") as number;
    const splitWithMinPause = config.get("splitWithMinPause") as boolean;
    let split_mode = config.get("splitMode") as SplitMode;
    if (split_mode == "ask") {
        let result = await vscode.window.showQuickPick(['length', 'half'], {
            placeHolder: "Select how to split the subtitle (set to ask every time)"
        });
        if (result != null) {
            split_mode = result as SplitMode;
        } else {
            return;
        }
    }

    const sub = subs[sub_i];
    const line_count = sub.line_lengths.length;
    if (line_count == 0) {
        vscode.window.showWarningMessage("Can't split a subtitle with no lines");
        return;
    }
    if (line_count % 2 != 0) {
        vscode.window.showWarningMessage("Can't split a subtitle with an odd number of lines");
        return;
    }

    const ind_lines = lines.splice(subs[sub_i + 1].line_pos);
    const new_lines = addToIndices(ind_lines, subs, sub_i + 1, 1);
    lines = lines.concat(new_lines);

    const split_point = sub.line_pos + 1 + line_count / 2;
    let mp = 0;
    if (splitWithMinPause) {
        mp = minPause;
    }

    let split_ms = 0;
    if (split_mode == "length") {
        const half = sub.line_lengths.length / 2;
        const length_first = sub.line_lengths.slice(0, half).reduce((p, v) => p + v);
        const length_second = sub.line_lengths.slice(half).reduce((p, v) => p + v);
        const per = length_first / (length_first + length_second);
        split_ms = Math.floor(sub.start_ms + sub.duration_ms * per)
    } else {
        split_ms = Math.floor(sub.start_ms + sub.duration_ms / 2);
    }

    const first_duration = makeDurFullMS(sub.start_ms, split_ms - mp);
    const second_duration = makeDurFullMS(split_ms + mp, sub.end_ms);
    const new_index = (sub.index + 1).toString();

    lines[sub.line_pos + 1] = first_duration;

    const new_header = [
        "",
        new_index,
        second_duration
    ];

    const after = lines.splice(split_point + 1);
    lines = lines.concat(new_header).concat(after);

    data.editor.edit(editBuilder => {
        editBuilder.replace(
            lineRangeN(data.editor, 0, data.editor.document.lineCount), lines.join('\n'))
    });
}

interface IndexFixPair {
    line: number,
    index: number,
}

function fixIndicesSurgical(lines: string[], subs: Subtitle[]): IndexFixPair[] {
    const pairs: IndexFixPair[] = [];
    for (let i = 0; i < subs.length; i++) {
        const sub = subs[i];
        const should = i + 1;
        if (sub.index != should) {
            pairs.push({
                line: sub.line_pos,
                index: should
            });
        }
    }
    return pairs;
}

export function fixIndicesEditor(editor: vscode.TextEditor): boolean | ParseError {
    const data = getData(editor);
    if (data == null) {
        return false;
    }

    const parseResult = parseSubtitles(data.lines);
    if (parseResult instanceof ParseError) {
        return parseResult;
    }

    const changes = fixIndicesSurgical(data.lines, parseResult);
    const changed = changes.length > 0;
    if (changed) {
        data.editor.edit(editBuilder => {
            for (const pair of changes) {
                const start = new vscode.Position(pair.line, 0);
                const end = new vscode.Position(pair.line, data.lines[pair.line].length);
                const range = new vscode.Range(start, end);
                editBuilder.replace(range, pair.index.toString());
            }
        })
    }
    return changed;
}

function srtFixIndices(data: SrtEditorData) {
    const result = fixIndicesEditor(data.editor);
    if (result instanceof ParseError) {
        console.error(result);
        vscode.window.showErrorMessage(result.toString());
        return;
    }
}

function subSort(lines: string[], subs: Subtitle[]): string[] {
    subs.sort((a, b) => a.start_ms - b.start_ms);

    const newLines: string[] = [];
    let index = 1;
    for (const sub of subs) {
        const startLine = sub.line_pos;
        newLines.push(index.toString());
        for (let i = startLine + 1; i < startLine + 2 + sub.line_lengths.length; i++) {
            newLines.push(lines[i]);
        }
        newLines.push("");
        index++;
    }
    return newLines;
}

function srtSort(data: SrtEditorData, subs: Subtitle[]) {
    const sorted = subSort(data.lines, subs);
    data.editor.edit(editBuilder => {
        editBuilder.replace(
            lineRangeN(data.editor, 0, data.editor.document.lineCount), sorted.join('\n'))
    });
}

function fixTiming(
    lines: string[],
    subs: Subtitle[],
    i: number,
    config: vscode.WorkspaceConfiguration): [string[] | null, string | null] {

    const minPause = config.get("minPause") as number;
    const minDuration = config.get("minDuration") as number;
    const fixBadMinPause = config.get("fixBadMinPause") as boolean;
    const fixWithMinPause = config.get("fixWithMinPause") as boolean;

    const sub = subs[i];
    const next = subs[i + 1];
    if (sub.start_ms > sub.end_ms) {
        return [null, `Subtitle ${sub.index} has a negative duration`]
    } else if (sub.end_ms > next.start_ms ||
        (fixBadMinPause && sub.end_ms > next.start_ms - minPause)) {
        let mp = 0;
        if (fixWithMinPause) {
            mp = minPause;
        }
        const new_end = next.start_ms - mp;

        if (new_end - sub.start_ms >= minDuration) {
            const dur_line = makeDurFullMS(sub.start_ms, new_end);
            lines[sub.line_pos + 1] = dur_line;
        } else {
            return [null, `Can't shrink subtitle ${sub.index}, would break minimum duration`];
        }
        return [lines, null];
    } else {
        return [null, null];
    }
}

function srtFixTiming(data: SrtEditorData, subs: Subtitle[], sub_i: number) {
    if (sub_i != subs.length) {
        const sub = subs[sub_i];
        const newLines = data.lines.slice();
        const [fix, error] = fixTiming(newLines, subs, sub_i, data.config);
        if (fix) {
            vscode.window.showInformationMessage(`Fixed timing for subtitle ${sub.index}`);
            data.editor.edit(editBuilder => {
                editBuilder.replace(
                    lineRangeN(data.editor, 0, data.editor.document.lineCount), fix.join('\n'))
            });
        } else if (error) {
            vscode.window.showErrorMessage(error);
        } else {
            vscode.window.showInformationMessage(`Nothing to fix for subtitle ${sub.index}`);
        }
    }
}

function srtFixTimingAll(data: SrtEditorData, subs: Subtitle[]) {
    let count = 0;
    const newLines = data.lines.slice();
    for (let i = 0; i < subs.length - 1; i++) {
        const [fix, error] = fixTiming(newLines, subs, i, data.config);
        if (fix) {
            count++;
        } else if (error) {
            vscode.window.showWarningMessage(error);
        }
    }
    if (count > 0) {
        data.editor.edit(editBuilder => {
            editBuilder.replace(
                lineRangeN(data.editor, 0, data.editor.document.lineCount), newLines.join('\n'))
        });
        vscode.window.showInformationMessage(`Fixed timings for ${count} subtitles`);
    } else {
        vscode.window.showInformationMessage("No timings to fix");
    }
}

function parseTime(str_in: string): number | null {
    let str = str_in;
    let mul = 1;
    if (str[0] == '-') {
        mul = -1;
        str = str.substring(1);
    }
    else if (str[0] == '+') {
        str = str.substring(1);
    }

    if (/^\d+$/.test(str)) {
        return parseInt(str) * mul;
    }

    const hmsmi = str.match(/^(\d+):(\d+):(\d+),(\d+)$/);
    if (hmsmi != null) {
        const h = parseInt(hmsmi[1]);
        const m = parseInt(hmsmi[2]);
        const s = parseInt(hmsmi[3]);
        const mi = parseInt(hmsmi[4]);
        return to_ms(h, m, s, mi) * mul;
    }

    const msmi = str.match(/^(\d+):(\d+),(\d+)$/);
    if (msmi != null) {
        const m = parseInt(msmi[1]);
        const s = parseInt(msmi[2]);
        const mi = parseInt(msmi[3]);
        return to_ms(0, m, s, mi) * mul;
    }

    const smi = str.match(/^(\d+),(\d+)$/);
    if (smi != null) {
        const s = parseInt(smi[1]);
        const mi = parseInt(smi[2]);
        return to_ms(0, 0, s, mi) * mul;
    }

    const hms = str.match(/^(\d+):(\d+):(\d+)$/);
    if (hms != null) {
        const h = parseInt(hms[1]);
        const m = parseInt(hms[2]);
        const s = parseInt(hms[3]);
        return to_ms(h, m, s, 0) * mul;
    }

    const ms = str.match(/^(\d+):(\d+)$/);
    if (ms != null) {
        const m = parseInt(ms[1]);
        const s = parseInt(ms[2]);
        return to_ms(0, m, s, 0) * mul;
    }

    return null;
}

/**
 * Shift subtitle timings.
 * @param lines Subtitle lines
 * @param subs Array of {@link Subtitle Subtitles}
 * @param from Start of range of subtitles to shift
 * @param to End of range of subtitles to shift (exclusive)
 * @param shift Milliseconds to shift
 * @returns New lines with shift applied
 */
function subShift(
    lines: string[],
    subs: Subtitle[],
    from: number,
    to: number,
    shift: number): [string[], string | null] {
    const newLines = lines.slice();
    if (to == -1) {
        to = subs.length - 1;
    }
    for (let i = from; i < to; i++) {
        const sub = subs[i];
        const new_start = sub.start_ms + shift;
        const new_end = sub.end_ms + shift;

        if (new_start < 0 || new_end < 0) {
            const over = 0 - new_start;
            const over_fmt = makeDurMS(over);
            return [lines, `Can't shift subtitle ${sub.index} before 0. Over by ${over_fmt}`];
        }

        newLines[sub.line_pos + 1] = makeDurFullMS(new_start, new_end);
    }
    return [newLines, null];
}

const shiftWarning =
    "Provide a valid time, e.g. 1000, 01:02, 01:02:03, 01:02:03,123, 01:02,123, 01,123";

async function srtShift(data: SrtEditorData, subs: Subtitle[]) {
    const sub_first = findSubtitle(subs, data.line);
    if (sub_first == null) {
        vscode.window.showWarningMessage("Not in a subtitle");
        return;
    }

    let sub_last = sub_first;
    if (data.line != data.endLine) {
        sub_last = findSubtitle(subs, data.endLine) || sub_first;
    }

    let result = await vscode.window.showInputBox({
        value: '100',
        placeHolder: "Time to shift",
        validateInput: text => {
            return parseTime(text) == null ? shiftWarning : null;
        }
    });

    if (result == null) { return; }
    const shift = parseTime(result);
    if (shift == null) { return; }

    const [lines, err] = subShift(data.lines, subs, sub_first, sub_last + 1, shift);
    if (err != null) {
        vscode.window.showErrorMessage(err);
        return;
    }

    const parseResult = parseSubtitles(lines);
    if (parseResult instanceof ParseError) {
        console.error(result);
        vscode.window.showErrorMessage(result.toString());
        return;
    }
    const sortedLines = subSort(lines, parseResult);

    data.editor.edit(editBuilder => {
        editBuilder.replace(
            lineRangeN(data.editor, 0, data.editor.document.lineCount), sortedLines.join('\n'))
    });
}

async function srtShiftAll(data: SrtEditorData, subs: Subtitle[]) {
    let result = await vscode.window.showInputBox({
        value: '100',
        placeHolder: "Time to shift",
        validateInput: text => {
            return parseTime(text) == null ? shiftWarning : null;
        }
    });

    if (result == null) { return; }
    const shift = parseTime(result);
    if (shift == null) { return; }

    const [lines, err] = subShift(data.lines, subs, 0, subs.length, shift);
    if (err != null) {
        vscode.window.showErrorMessage(err);
        return;
    }

    data.editor.edit(editBuilder => {
        editBuilder.replace(
            lineRangeN(data.editor, 0, data.editor.document.lineCount), lines.join('\n'))
    });
}

export function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(defineCommandSubtitle("echo", echoCurrentSubtitle));
    context.subscriptions.push(defineCommandSubtitle("merge", srtMerge));
    context.subscriptions.push(defineCommandSubtitle("split", srtSplit));
    context.subscriptions.push(defineCommand("fixIndices", srtFixIndices));
    context.subscriptions.push(defineCommandSubs("sort", srtSort));
    context.subscriptions.push(defineCommandSubtitle("fixTiming", srtFixTiming));
    context.subscriptions.push(defineCommandSubs("fixTimingAll", srtFixTimingAll));
    context.subscriptions.push(defineCommandSubs("shift", srtShift));
    context.subscriptions.push(defineCommandSubs("shiftAll", srtShiftAll));
}
