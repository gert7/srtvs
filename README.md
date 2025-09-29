# srt

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/gert7.srt-subrip)](https://marketplace.visualstudio.com/items/?itemName=gert7.srt-subrip)

[![ko-fi](./images/githubbutton_sm.png)](https://ko-fi.com/N4N116CYI2)

This is a port of the [srt.nvim](https://github.com/gert7/srt.nvim) extension for NeoVim for SubRip
subtitles.

## Features

### Passive features

- Durations and pauses
- 'Characters per second' warning
- Warnings for durations too long, too short, overlapping
- Warnings for pauses being too short
- Automatically corrects indices after editing

### Commands

- Jump cursor to subtitle by index
- Merge two or more subtitles
- Split subtitles into two
- Sort subtitles by start time
- Fix overlapping timings for one or all subtitles
- Shift one, multiple or all subtitles by a given offset
- Add a subtitle
- Shift the beginning or end time of a duration (based on cursor position)
- Shift with strict timing
- Delete empty lines that cause syntax errors

## Settings

In addition to configuring global warnings, you can also specify the warnings `minDuration` (minimum
duration in milliseconds), `maxDuration` (maximum duration in milliseconds), `maxLength` (maximum
length per line) and `maxLengthSub` (maximum length per entire subtitle) based on how many lines are
in a subtitle:

```javascript
"srt-subrip.rulesByLineCount": {
    "1": {
        "maxDuration": 3000,
        "maxLength": 40
    },
    "2": {
        "maxDuration": 10000,
        "maxLength": 50
    }
}
```

## Known Issues

Using the built-in undo function of the Vim extension is strongly discouraged.

Report any issues to our [issue tracker](https://github.com/gert7/srtvs/issues).

## Release Notes

### 1.0.0

Initial release.

### 1.1.0

Add elevating CPS warning to error diagnostic.

### 1.2.0

Add command to delete empty lines commonly found in automated translations