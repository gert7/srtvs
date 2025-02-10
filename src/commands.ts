import * as vscode from "vscode";
import { getData, SrtEditorData } from "./get_subs";

function defineCommand(name: string, func: (data: SrtEditorData) => {}): vscode.Disposable {
    return vscode.commands.registerCommand(name, () => {
        const data = getData();
        if (data) {
            func(data);
        }
    });
}

function defineCommandLines(name: string, func: (data: SrtEditorData) => {}): vscode.Disposable {
    return vscode.commands.registerCommand(name, () => {
        const data = getData();
        if (data) {
            func(data);
        }
    });
}

export function registerCommands(context: vscode.ExtensionContext) {

}