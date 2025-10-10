import * as vscode from 'vscode';
import * as getSubs from './get_subs';
import { fixIndicesEditor, registerCommands } from './commands';

let myStatusBarItem: vscode.StatusBarItem;
let enabled = true;

const EXT_NAME = "srt-subrip";

export class SrtInlayHintsProvider implements vscode.InlayHintsProvider {
	private _onDidChange = new vscode.EventEmitter<void>();

	readonly onDidChangeInlayHints = this._onDidChange.event;

	provideInlayHints(
		document: vscode.TextDocument,
		range: vscode.Range,
		token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint[]>
	{
		return getSubs.getInlays(document);
	}

	public refreshHints() {
		this._onDidChange.fire();
	}
}

export function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration(EXT_NAME);

	const provider = new SrtInlayHintsProvider();

	vscode.window.onDidChangeActiveTextEditor((editor) => {
		try {
			if (editor) {
				getSubs.annotateSubs(editor.document, enabled);
			}
		} catch (e) {
			console.error(e);
		}
	});
	vscode.workspace.onDidOpenTextDocument((document) => {
		try {
			getSubs.annotateSubs(document, enabled);
		} catch (e) {
			console.error(e);
		}
	});
	vscode.workspace.onDidChangeTextDocument((event) => {
		try {
			getSubs.annotateSubs(event.document, enabled);
			if (event.reason === undefined && // not undo or redo
				event.document.languageId === 'subrip') {
				const config = vscode.workspace.getConfiguration(EXT_NAME);
				const autofixIndex = config.get("autofixIndex") as boolean;
				if (autofixIndex) {
					const editor =
						vscode.window.visibleTextEditors.find(
							(e) => e.document.uri === event.document.uri);
					if (editor) {
						fixIndicesEditor(editor);
					}
				}
			}
		} catch (e) {
			console.error(e);
		}
	});
	vscode.workspace.onDidCloseTextDocument((document) => getSubs.disposeDecorations(document));

	vscode.languages.registerInlayHintsProvider('subrip', provider);

	context.subscriptions.push(getSubs.getDiagnosticCollection());

	const enabledByDefault = config.get("enabled") as boolean;

	enabled = enabledByDefault;

	const myCommandId = `${EXT_NAME}.toggleHUD`;
	context.subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
		enabled = !enabled;
		const editors = vscode.window.visibleTextEditors;
		for (const editor of editors) {
			getSubs.annotateSubs(editor.document, enabled);
		}
		updateStatusBarItem();
		provider.refreshHints();
	}));

	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	myStatusBarItem.command = myCommandId;
	myStatusBarItem.tooltip = "Toggle Overlay and Diagnostics for SubRip files";
	context.subscriptions.push(myStatusBarItem);

	myStatusBarItem.show();

	updateStatusBarItem();

	try {
		registerCommands(context);
	} catch (e) {
		console.error(e);
	}
}

export function deactivate() {
	getSubs.disposeAllDecorations();
}

function updateStatusBarItem(): void {
	myStatusBarItem.text = enabled ? '💬 SRT' : '💭 srt';
}
