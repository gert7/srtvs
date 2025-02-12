import * as vscode from 'vscode';
import { DiagnosticSeverity } from 'vscode';
import { blankSubtitle, parseFullTiming, Subtitle } from './subtitle';

const diagnosticCollection = vscode.languages.createDiagnosticCollection("subrip");

export interface SrtEditorData {
	config: vscode.WorkspaceConfiguration,
	editor: vscode.TextEditor,
	line: number,
	col: number,
	lines: string[],
	endLine: number
}

export function getLines(editor: vscode.TextEditor) {
	return editor.document.getText().replace(/\r\n/g, '\n').split('\n');
}

export function getData(): SrtEditorData | null {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return null;
	const lines = editor?.document.getText().replace(/\r\n/g, '\n').split('\n');
	return {
		config: vscode.workspace.getConfiguration("subrip"),
		editor: editor,
		line: editor.selection.start.line,
		col: editor.selection.active.character,
		lines: lines,
		endLine: editor.selection.end.line
	}
}

const enum State {
	Index,
	Timing,
	Subtitle
}

function fmtS(ms: number) {
	let neg = '';
	if (ms < 0) {
		neg = '-';
		ms = -ms;
	}
	const timing_milli = ms % 1000;
	const timing_secs = (ms - timing_milli) / 1000;

	const tm_padded = timing_milli.toString().padStart(3, "0");
	return `${neg}${timing_secs}.${tm_padded}s`;
}

function removeTags(s: string) {
	return s.replace(/<[^>]+>/g, "");
}

const decorations: Map<vscode.Uri, Array<vscode.TextEditorDecorationType>> = new Map();
const inlays: Map<vscode.Uri, Array<vscode.InlayHint>> = new Map();

export function getInlays(document: vscode.TextDocument): vscode.InlayHint[] | undefined {
	return inlays.get(document.uri);
}

export function disposeAllDecorations() {
	decorations.forEach((arr, _) => arr.forEach((d) => d.dispose()));
	inlays.forEach((_, k) => inlays.set(k, []));
}

export function disposeDecorations(document: vscode.TextDocument) {
	let markList = decorations.get(document.uri);
	if (markList) {
		markList.forEach((m) => m.dispose());
	}
	decorations.set(document.uri, []);
	inlays.set(document.uri, []);
}

export function annotateSubs(document: vscode.TextDocument, enabled: boolean) {
	const config = vscode.workspace.getConfiguration("subrip");
	const editor = vscode.window.activeTextEditor;
	if (document.languageId !== "subrip" || document.uri != editor?.document.uri) return;

	const text = document.getText().replace(/\r\n/g, '\n');
	const lines = text.split("\n");

	const diagnostics: vscode.Diagnostic[] = [];

	let state = State.Index;

	let last_end = 0;
	let cur_start = 0;
	let cur_end = 0;

	let line_count = 0;
	let line_lengths: number[] = [];
	let last_timing = 0;
	let total_length = 0;
	let last_timing_k = 0;
	let last_index = 0;

	const extraSpacesSetting = config.get("extraSpaces") as number;
	const extra_spaces = " ".repeat(extraSpacesSetting);

	const alwaysCPS = config.get("cps") as boolean;
	const warningCPS = config.get("cpsWarning") as boolean;
	const maxCPS = config.get("maxCPS") as number;
	const showPause = config.get("showPause") as boolean;
	const overlapWarning = config.get("overlapWarning") as boolean;
	const lengthEnabled = config.get("length") as boolean;

	const ins: vscode.InlayHint[] = [];
	inlays.set(document.uri, ins);
	const hintList = ins;

	diagnosticCollection.clear();

	if (!enabled) {
		return;
	}

	function add_error(ln: number, text: string) {
		const range = new vscode.Range(ln, 0, ln, lines[ln].length);
		diagnostics.push(new vscode.Diagnostic(range, text, DiagnosticSeverity.Error))
	}

	function add_hint(ln: number, text: string) {
		hintList?.push(new vscode.InlayHint(new vscode.Position(ln, lines[ln].length), text));
	}

	const minPause = config.get("minPause") as number;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (state == State.Index && line != "") {
			const n = line.match(/^\d+$/);
			if (!n) {
				add_error(i, "Error reading subtitle index!");
				break;
			}
			const index = parseInt(n[0]);

			if (index != last_index + 1) {
				add_error(i, "Subtitle index not sequential!");
			}
			last_index = index;
			state = State.Timing;
		} else if (state == State.Timing) {
			const [from, to] = parseFullTiming(line);
			if (!from || !to) {
				add_error(i, "Error reading duration!");
				break;
			}

			last_timing_k = i;
			last_timing = to - from;

			if (from < cur_start) {
				add_error(i - 1, "Subtitle appears before previous subtitle!");
			}

			last_end = cur_end;
			cur_start = from;
			cur_end = to;

			const pause = cur_start - last_end;

			const pauseline = i - 3;

			if (showPause && pauseline > 0) {
				add_hint(pauseline + 1, "                 (" + fmtS(pause) + ")");
			}

			if (overlapWarning && pause < 0) {
				add_error(pauseline + 1, "Subtitle overlaps with previous subtitle");
			} else if (pause < minPause) {
				add_error(pauseline + 1, "Pause is too short");
			}
			state = State.Subtitle;
		} else if (state == State.Subtitle) {
			if (line != "") {
				const clean = removeTags(line);
				const len = clean.length;
				total_length += len;
				line_count++;
				line_lengths.push(len);
			} else {
				const dbz = last_timing == 0;
				let cps = 0;
				if (!dbz) {
					cps = total_length / last_timing * 1000;
				} else {
					cps = NaN;
				}

				// TODO: Skipped all the diagnostics for now

				let dur_bar = "";

				if (lengthEnabled) {
					dur_bar = dur_bar + extra_spaces + " =  " + fmtS(last_timing);
				}

				if (!isNaN(cps) &&
					(alwaysCPS || (warningCPS && cps > maxCPS))) {
					const percent = cps / maxCPS * 100;
					dur_bar = dur_bar + ' (' + Math.floor(percent) + '%)';
				}

				add_hint(last_timing_k, dur_bar);
				state = State.Index;
				line_count = 0;
				total_length = 0;
				line_lengths = [];
			}
		}
	};

	if (state == State.Timing) {
		add_error(lines.length - 1, "Subtitle is not terminated");
	}

	diagnosticCollection.set(document.uri, diagnostics);
}

export class ParseError {
	error: string
	line: number
	constructor(error: string, line: number) {
		this.error = error;
		this.line = line;
	}
}

/**
 * Parse a subtitle file and return the subtitles.
 * @param lines The LF-terminated lines to parse.
 * @returns An array of {@link Subtitle} or an error string.
 */
export function parseSubtitles(lines: string[]): Subtitle[] | ParseError {
	let state = State.Index;
	let overFirst = false;

	const subtitles: Subtitle[] = [];

	let nextSubtitle = blankSubtitle();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (state == State.Index) {
			if (line == "" && overFirst) {
				nextSubtitle.line_lengths.push(0);
			} else if (line != "") {
				const n = line.match(/^\d+$/);
				if (!n) {
					return new ParseError("Error reading subtitle index!", i);
				}
				nextSubtitle.line_pos = i;
				const index = parseInt(n[0]);

				nextSubtitle.index = index;
				state = State.Timing;
			}
		} else if (state == State.Timing) {
			const [from, to] = parseFullTiming(line);
			if (!from || !to) {
				return new ParseError("Error reading duration!", i);
			}

			nextSubtitle.start_ms = from;
			nextSubtitle.end_ms = to;
			nextSubtitle.duration_ms = to - from;

			state = State.Subtitle;
		} else if (state == State.Subtitle) {
			if (line == "") {
				subtitles.push(nextSubtitle);
				nextSubtitle = blankSubtitle();
				state = State.Index;
			} else {
				const clean_s = removeTags(line);
				nextSubtitle.line_lengths.push(clean_s.length);
			}
		}
	}

	if (state == State.Subtitle) {
		subtitles.push(nextSubtitle);
	}

	return subtitles;
}

export function findSubtitle(subs: Subtitle[], line: number): number | null {
	let low = 0;
	let high = subs.length - 1;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const sub = subs[mid];
		const start = sub.line_pos;
		const finish = start + 2 + sub.line_lengths.length;
		if (line < start) {
			high = mid - 1;
		} else if (line > finish) {
			low = mid + 1;
		} else {
			return mid;
		}
	}
	return null;
}

export function getDiagnosticCollection(): vscode.DiagnosticCollection {
	return diagnosticCollection;
}
