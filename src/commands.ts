import * as vscode from "vscode";
import { findSubtitle, getData, getLines, ParseError, parseSubtitles, SrtEditorData } from "./get_subs";
import { Subtitle } from "./subtitle";

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
    // const sub = subs[sub_i];
    // vscode.window.showWarningMessage(`On subtitle number ${sub.index}`);
    const line = data.editor.selection.start.line;
    vscode.window.showWarningMessage(`On line number ${line}`);
}

function subMerge(lines: string[], editor: vscode.TextEditor, subs: Subtitle[], sub_i: number) {
    const ind_lines = lines.slice(subs[sub_i + 1].line_pos);
    const new_lines = addToIndices(ind_lines, subs, sub_i + 1, -1).join('\n');
    const ind_start = new vscode.Position(subs[sub_i + 1].line_pos, 0);
    const ind_end = new vscode.Position(editor.document.lineCount, 0);
    editor.edit(editBuilder => {
        editBuilder.replace(new vscode.Range(ind_start, ind_end), new_lines);
    })
    return lines;
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

    for (let i = sub_first; i < sub_last; i++) {
        console.log(`Ukmerge ${i}`);
        const lines = getLines(data.editor);
        const result = parseSubtitles(lines);
        if (result instanceof ParseError) {
            vscode.window.showErrorMessage(`Unexpected error on line ${result.line}: ${result.error}`);
        }
        subMerge(lines, data.editor, subs, sub_first);
    }
}

export function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(defineCommandSubtitle("echo", echoCurrentSubtitle));
    context.subscriptions.push(defineCommandSubtitle("merge", srtMerge));
}