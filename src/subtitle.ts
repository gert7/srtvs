export interface Subtitle {
    line_pos: number,
    index: number,
    start_ms: number,
    end_ms: number,
    duration_ms: number,
    line_lengths: number[]
}

export function blankSubtitle(): Subtitle {
    return {
        line_pos: 0,
        index: 0,
        start_ms: 0,
        end_ms: 0,
        duration_ms: 0,
        line_lengths: [],
    }
}

const matcherFull = /^(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)$/;

export function to_ms(h: number, m: number, s: number, mi: number) {
    return mi + s * 1000 + m * 60000 + h * 3600000;
}

export function from_ms(ms: number): number[] {
    const h = Math.floor(ms / 3600000)
    ms = ms - h * 3600000
    const m = Math.floor(ms / 60000)
    ms = ms - m * 60000
    const s = Math.floor(ms / 1000)
    ms = ms - s * 1000
    return [h, m, s, ms]
}

export function parseFullTiming(line: string): number[] | null[] {
    const r = line.match(matcherFull);
    if (!r) {
        return [null, null]
    }
    return [to_ms(
        parseInt(r[1]),
        parseInt(r[2]),
        parseInt(r[3]),
        parseInt(r[4])),
    to_ms(
        parseInt(r[5]),
        parseInt(r[6]),
        parseInt(r[7]),
        parseInt(r[8]),
    )]
}

export function makeDur(h: number, m: number, s: number, mi: number): string {
    const nh = h.toString().padStart(2, "0");
    const nm = m.toString().padStart(2, "0");
    const ns = s.toString().padStart(2, "0");
    const nmi = mi.toString().padStart(3, "0");
    return `${nh}:${nm}:${ns},${nmi}`;
}

export function makeDurMS(ms: number): string {
    const [h, m, s, mi] = from_ms(ms);
    return makeDur(h, m, s, mi);
}

export function makeDurFull(
    fh: number,
    fm: number,
    fs: number,
    fmi: number,
    th: number,
    tm: number,
    ts: number,
    tmi: number): string {
    const h1 = fh.toString().padStart(2, "0");
    const m1 = fm.toString().padStart(2, "0");
    const s1 = fs.toString().padStart(2, "0");
    const mi1 = fmi.toString().padStart(3, "0");
    const h2 = th.toString().padStart(2, "0");
    const m2 = tm.toString().padStart(2, "0");
    const s2 = ts.toString().padStart(2, "0");
    const mi2 = tmi.toString().padStart(3, "0");
    return `${h1}:${m1}:${s1},${mi1} --> ${h2}:${m2}:${s2},${mi2}`;
}

export function makeDurFullMS(fms: number, tms: number): string {
    const [fh, fm, fs, fmi] = from_ms(fms);
    const [th, tm, ts, tmi] = from_ms(tms);
    return makeDurFull(fh, fm, fs, fmi, th, tm, ts, tmi);
}

export function amendStart(line: string, new_ms: number) {
    const end_time = line.substring(12, 29);
    const start_time = makeDurMS(new_ms);
    return `${start_time}${end_time}`;
}

export function amendEnd(line: string, new_ms: number) {
    const start_time = line.substring(0, 17);
    const end_time = makeDurMS(new_ms);
    return `${start_time}${end_time}`;
}
