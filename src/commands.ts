import * as vscode from "vscode";
import { findSubtitle, getData, getLines, ParseError, parseSubtitles, SrtEditorData } from "./get_subs";
import { makeDurFullMS, Subtitle } from "./subtitle";

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

// function subMerge(lines: string[], editor: vscode.TextEditor, subs: Subtitle[], sub_i: number) {
//     const ind_lines = lines.slice(subs[sub_i + 1].line_pos);
//     const new_lines = addToIndices(ind_lines, subs, sub_i + 1, -1).join('\n');
//     const range = lineRange(subs[sub_i + 1].line_pos, editor.document.lineCount);

//     const sub = subs[sub_i];
//     const next = subs[sub_i + 1];
//     const del_from = next.line_pos - 1;
//     const dur_line = makeDurFullMS(sub.start_ms, next.end_ms);
//     editor.edit(editBuilder => {
//         editBuilder.replace(range, new_lines);
//     }).then(() => {
//         editor.edit(editBuilder => {
//             editBuilder.delete(lineRange(del_from, del_from + 3));
//             editBuilder.replace(lineRangeN(editor, sub.line_pos + 1, sub.line_pos + 2), dur_line);
//         })
//     })

//     return lines;
// }

function subMerge(lines: string[], subs: Subtitle[], sub_i: number): string[] {
    const ind_lines = lines.splice(subs[sub_i + 1].line_pos);
    const new_lines = addToIndices(ind_lines, subs, sub_i + 1, - 1);
    console.dir(new_lines);
    console.log(`${lines.length}, ${ind_lines.length}, ${new_lines.length}`);
    console.dir(lines);
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
            vscode.window.showErrorMessage(`Unexpected error on line ${result.line}: ${result.error}`);
            return;
        }
        newLines = subMerge(newLines, result, sub_first);
    }
    data.editor.edit(editBuilder => {
        editBuilder.replace(lineRangeN(data.editor, 0, data.editor.document.lineCount), newLines.join('\n'));
    });
}

export function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(defineCommandSubtitle("echo", echoCurrentSubtitle));
    context.subscriptions.push(defineCommandSubtitle("merge", srtMerge));
}