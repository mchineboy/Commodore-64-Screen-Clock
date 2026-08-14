# Commodore 64 Screen Clock

A large, configurable screen clock for the Commodore 64, written by Steven
Hardison in 2026. It can display the time as large seven-segment digits or a
dot-matrix clock, with themes, colours, user text, and a small amount of
burn-in protection.

The original program lives in [`shclock12.prg`](shclock12.prg). It is a
**tokenized C64 BASIC V2 PRG** (load address `$0801`), not a plain-text source
file. It should be loaded directly by a C64 or emulator.

## What it needs

* A Commodore 64 or a C64 emulator such as [VICE](https://vice-emu.sourceforge.io/).
* A display capable of the normal 40-column C64 text screen.
* A TeensyROM RTC is expected by the original startup code. The program writes
  to `$DEB4` (57012), waits for `$DEB6` (57014), then copies the time value at
  `$DEBA` (57018) into the C64 `TI` clock.
* Device 8 is needed only when saving or loading a custom theme. A disk drive,
  SD2IEC, or an emulator drive image can provide it.

The RTC wait is intentional: without the TeensyROM service the original program
will wait at startup instead of guessing the current time.

## Running the original

In VICE, attach or autostart `shclock12.prg`, then run it. On a real C64, copy
the file to a disk and use:

```basic
LOAD"SHCLOCK12.PRG",8,1
RUN
```

The first screen is a title/help page. Press any key to start the clock. Press
`?` or `/` while the clock is running to show the command reference again.

## Controls

| Key | Action |
| --- | --- |
| `T` | Set the time as six digits: `HHMMSS` in 24-hour time. |
| `1` / `2` | Use 12-hour / 24-hour time. |
| `3` / `4` | Display metric time / percent of the day. |
| `5`–`8` | Select one of four seven-segment colour and character themes. |
| `9` / `0` | Select one of two dot-matrix themes. |
| `C` | Set the number colour (0–15). |
| `G` / `B` | Set the screen / border colour (0–15). |
| `M` | Set the complications colour: AM/PM and other small text. |
| `W` / `E` | Set an optional text message (up to 30 characters) / its colour. |
| `P` | Turn screen burn protection on or off (`Y` / `N`). |
| `Z` | Show or hide a leading zero (`Y` / `N`). |
| `:` | Set the blinking-colon rate, from 0 (static) to 255. |
| `*` / `@` | Set the segment character / its colour. |
| `H` / `V` | Set the horizontal / vertical segment character. These controls are for segment themes. |
| `S` / `L` | Save / load a custom theme on device 8. |
| `R` | Restore the default settings. |
| `CLR` / `HOME` | Clear input while typing a value. |

Colour values use the normal C64 palette: 0 black, 1 white, 2 red, 3 cyan,
4 purple, 5 green, 6 blue, 7 yellow, 8 orange, 9 brown, 10 light red,
11 dark gray, 12 gray, 13 light green, 14 light blue, and 15 light gray.

### Saving themes

Choose `S`, give the theme a short filename, and the clock writes its settings
to device 8. `L` reads a previously saved filename. The program stores colours,
characters, the display mode, burn protection, leading-zero preference, and
the custom text. It does not save the current time.

## Documented, optimized BASIC edition

The original is preserved unchanged. The optimized edition is generated as
[`basic/shclock12-optimized.prg`](basic/shclock12-optimized.prg), with a
human-reviewable [listing](basic/shclock12-optimized.list).

It changes only startup overhead and documentation:

* Adds short `REM` statements at each major routine.
* Removes the two unused scalar `DIM` statements at lines 110 and 120. C64
  BASIC automatically creates scalar variables, so these declarations provide
  no storage or behavior.
* Leaves every original token and PETSCII screen-art byte untouched. This is
  important because converting the program to ordinary text and back can alter
  C64 screen codes in quoted strings.

To reproduce the generated files on macOS or Linux, install VICE (for `petcat`)
and Node.js, then run:

```sh
make basic
```

`tools/optimize-basic.mjs` edits the C64 BASIC line records directly, recalculates
their linked-list pointers, and writes a valid `$0801` PRG. `petcat -2` then
creates the listing used for code review.

### Fast BASIC edition

`make fast` creates `basic/shclock12-fast.prg`. It keeps the original commands,
themes, saved settings, RTC synchronization, and display formats, but aggressively
reduces work in the live display loop:

* The main loop waits for the next C64 jiffy (1/60 second on NTSC; 1/50 on PAL)
  before it updates. Keyboard response remains within one jiffy.
* The blinking colon is still evaluated each jiffy.
  Its setting is multiplied by 15 so the inherited default of `2` produces a
  comfortable roughly one-second blink cycle instead of a 10 Hz flicker.
* Time formatting, screen printing, digit comparison, and segment redraw checks
  occur only when `TI$` changes: once per displayed second, rather than in every
  tight-loop pass.

This is deliberately a separate PRG. The documented edition remains the closest
possible rendition of Dad's original, while the fast edition makes a measurable
runtime tradeoff without removing a feature.

## Repository and pull-request workflow

This project intentionally uses a fork so that changes can be reviewed as
pull requests:

* [`Hardison1958/Commodore-64-Screen-Clock`](https://github.com/Hardison1958/Commodore-64-Screen-Clock)
  is the original repository and the PR destination.
* [`mchineboy/Commodore-64-Screen-Clock`](https://github.com/mchineboy/Commodore-64-Screen-Clock)
  is the working fork where feature branches are pushed.

The local checkout uses the same names:

```text
origin    mchineboy/Commodore-64-Screen-Clock
upstream  Hardison1958/Commodore-64-Screen-Clock
```

For each change, create a focused branch, commit it, push it to `origin`, and
open a draft PR with `upstream`'s `main` branch as the base. Dad can then read
the Files changed tab, leave comments, approve it, and merge it when ready.

Current draft PRs are [#1: rename the BASIC file](https://github.com/Hardison1958/Commodore-64-Screen-Clock/pull/1)
and [#2: document and optimize BASIC](https://github.com/Hardison1958/Commodore-64-Screen-Clock/pull/2).

## Planned assembly editions

The next versions will be written in 6502 assembly:

1. A feature-for-feature digital version of the original program, including all
   controls and custom-theme persistence.
2. A third build that retains those digital options and adds an analog dial as
   a selectable display mode.

Keeping them as separate pull requests makes it possible to compare the BASIC
and assembly implementations one focused change at a time.
