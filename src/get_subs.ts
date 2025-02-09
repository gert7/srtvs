import * as vscode from 'vscode';

const diagnosticCollection = vscode.languages.createDiagnosticCollection("subrip");

const enum State {
    Index,
    Timing,
    Subtitle
}

const decorations: Map<vscode.Uri, Array<vscode.TextEditorDecorationType>> = new Map();

export function disposeDecorations(document: vscode.TextDocument) {
	let markList = decorations.get(document.uri);
	if (markList) {
		markList.forEach((m) => m.dispose());
	}
	decorations.set(document.uri, []);
	console.log(`Disposing decorations for ${document.uri}`);
}

export function annotateSubs(document: vscode.TextDocument) {
	console.log("annotating");
	const editor = vscode.window.activeTextEditor;
	if (document.languageId !== "subrip" || document.uri != editor?.document.uri) return;

	const text = document.getText();
	const lines = text.split("\n");

	const diagnostics: vscode.Diagnostic[] = [];

	let last_end = 0;
	let cur_start = 0;
	let cur_end = 0;

	let line_count = 0;
	let line_lengths: number[] = [];
	let last_timing = 0;
	let total_length = 0;
	let last_timing_k = 0;
	let last_index = 0;

	let markList = decorations.get(document.uri);
	if (markList) {
		markList.forEach((m) => m.dispose());
	} else {
		const list: vscode.TextEditorDecorationType[] = [];
		decorations.set(document.uri, list);
		markList = list;
	}

	function setMark(lineNumber: number, text: string) {
		if(!editor) return;
		const line = document.lineAt(lineNumber);
		const range = new vscode.Range(line.range.end, line.range.end);
		const decorationType = vscode.window.createTextEditorDecorationType({
			after: {
				contentText: text,
				color: 'gray',
			}
		});

		markList?.push(decorationType);
		editor.setDecorations(decorationType, [range]);
	}

	lines.forEach((line, i) => {
		// if (line.includes("-->") && !/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/.test(line)) {
		// 	const range = new vscode.Range(i, 0, i, line.length);
		// 	diagnostics.push(new vscode.Diagnostic(range, "Invalid timestamp format", vscode.DiagnosticSeverity.Warning));
		// }
		setMark(i, "Hello World!")
	});

	diagnosticCollection.set(document.uri, diagnostics);

}

export function getDiagnosticCollection(): vscode.DiagnosticCollection {
    return diagnosticCollection;
}
