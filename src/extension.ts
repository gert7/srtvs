import * as vscode from 'vscode';
import { annotateSubs, disposeDecorations, getDiagnosticCollection, getInlays } from './get_subs';

let decorationType: vscode.TextEditorDecorationType | null = null

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "srt-subrip" is now active!');

	const disposable = vscode.commands.registerCommand('srt-subrip.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from srt!');
	});

	context.subscriptions.push(disposable);

	vscode.window.onDidChangeActiveTextEditor((editor) => {
		try {
			if (editor) {
				annotateSubs(editor.document);
			}
		} catch (e) {
			console.error(e);
		}
	});
	vscode.workspace.onDidOpenTextDocument((document) => {
		try {
			annotateSubs(document);
		} catch (e) {
			console.error(e);
		}
	});
	vscode.workspace.onDidChangeTextDocument((event) => {
		try {
			annotateSubs(event.document);
		} catch (e) {
			console.error(e);
		}
	})
	vscode.workspace.onDidCloseTextDocument((document) => disposeDecorations(document));

	vscode.languages.registerInlayHintsProvider('subrip', {
		provideInlayHints(document, range, token) {
			return getInlays(document);
		}
	});

	context.subscriptions.push(getDiagnosticCollection());
}

export function deactivate() { }
