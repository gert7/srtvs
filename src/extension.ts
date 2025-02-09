import * as vscode from 'vscode';
import { annotateSubs, disposeDecorations, getDiagnosticCollection } from './get_subs';

let decorationType: vscode.TextEditorDecorationType | null = null

function appendTimestamp(document: vscode.TextDocument) {
	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	if (decorationType) {
		decorationType.dispose();
	}

	decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: ` ⏱ ${new Date().toLocaleTimeString()}`,
			color: 'gray',
			fontStyle: 'italic',
		}
	});

	const lineNumber = 2; // Change this to the desired line number (zero-based index)
	const line = document.lineAt(lineNumber);
	const range = new vscode.Range(line.range.end, line.range.end);

	editor.setDecorations(decorationType, [range]);
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "srt-subrip" is now active!');

	const disposable = vscode.commands.registerCommand('srt-subrip.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from srt!');
	});

	context.subscriptions.push(disposable);

	// vscode.workspace.onDidOpenTextDocument(annotateSubs);

	// vscode.window.onDidChangeActiveTextEditor((editor) => {
	// 	console.log("active editor change")
	// 	if (editor) annotateSubs(editor);
	// });
	vscode.workspace.onDidOpenTextDocument((document) => annotateSubs(document));
	vscode.workspace.onDidChangeTextDocument((event) => annotateSubs(event.document))
	// vscode.workspace.onDidChangeTextDocument((event) => appendTimestamp(event.document))
	vscode.workspace.onDidCloseTextDocument((document) => disposeDecorations(document));

	// context.subscriptions.push(getDiagnosticCollection());
}

export function deactivate() { }
