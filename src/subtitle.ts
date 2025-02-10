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