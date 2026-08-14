# Project status — 2026-08-14

## Goal

Preserve Steven Hardison's C64 screen clock, make it easier to review through
small pull requests, optimize its BASIC implementation, then produce a complete
6502 assembly version and an optional analog-dial version.

## Repository and pull-request setup

The working fork is [`mchineboy/Commodore-64-Screen-Clock`](https://github.com/mchineboy/Commodore-64-Screen-Clock).
Dad's original repository is [`Hardison1958/Commodore-64-Screen-Clock`](https://github.com/Hardison1958/Commodore-64-Screen-Clock).

The local remotes are intentionally configured as follows:

```text
origin    git@github.com:mchineboy/Commodore-64-Screen-Clock.git
upstream  https://github.com/Hardison1958/Commodore-64-Screen-Clock.git
```

All pull requests are drafts against `upstream/main` and are stacked in this
order. Merge them in order (or rebase later PRs once their parents merge).

| PR | Branch | Purpose | State |
| --- | --- | --- | --- |
| [#1](https://github.com/Hardison1958/Commodore-64-Screen-Clock/pull/1) | `codex/rename-basic-file` | Rename the tokenized C64 program to the accurate `.prg` extension. | Draft; ready for review. |
| [#2](https://github.com/Hardison1958/Commodore-64-Screen-Clock/pull/2) | `codex/basic-optimization` | Documented BASIC edition, project README, and safe cleanup. | Draft; depends on #1. |
| [#3](https://github.com/Hardison1958/Commodore-64-Screen-Clock/pull/3) | `codex/basic-fast-path` | Jiffy-throttled pure-BASIC fast edition. | Draft; depends on #1–#2. |
| [#4](https://github.com/Hardison1958/Commodore-64-Screen-Clock/pull/4) | `codex/basic-hybrid-renderer` | Hybrid BASIC + 6502 segment renderer experiment. | Draft; close, but not yet correct. |

## Files and versions

| File | Purpose | Status |
| --- | --- | --- |
| `shclock12.prg` | Dad's preserved original tokenized BASIC V2 program. | Do not edit. |
| `basic/shclock12-optimized.prg` | Original with section `REM`s and redundant scalar `DIM`s removed. | Builds and lists correctly. |
| `basic/shclock12-fast.prg` | Pure-BASIC timed update loop. | The preferred optimized edition while hybrid is unfinished. |
| `basic/shclock12-hybrid.prg` | Fast BASIC plus a 6502 segment-drawing helper. | Runs, but segment output still needs visual correction. |
| `assembly/segment-blitter.s` | Source for the hybrid helper. | Experimental; not a full assembly clock. |

## Confirmed behavior and findings

### Original program

* The source is a tokenized C64 BASIC V2 PRG loaded at `$0801`, not a text `.bas`
  file.
* Startup expects the TeensyROM RTC: it writes `$DEB4`, waits for `$DEB6`, and
  copies the value at `$DEBA` into the C64 `TI` clock.
* It supports 12/24-hour, metric, and percent-day modes; segment and dot-matrix
  themes; colour/character controls; text; burn protection; leading zero; and
  device-8 theme save/load.

### Fast BASIC edition

* The original tight display loop was changed to wait for the next `TI` jiffy.
* Colon animation is evaluated every jiffy.
* Expensive time formatting and digit comparisons run only when `TI$` changes,
  normally once per second.
* This edition initially had a conditional-flow bug in C64 BASIC `IF ... THEN`
  syntax and an overly fast/slow blink tuning issue; both were corrected.
* A VIC-screen-blanking experiment was tried and then removed because the flash
  was distracting.

### Hybrid renderer

The hybrid version is intentionally limited to seven-segment themes. BASIC still
selects the theme, calculates `S1`–`S7`, handles input, and draws dot-matrix
themes. It passes position, offset, characters, and colours to a helper at
`$C000` via `$C300`–`$C30A`, then calls `SYS 49152`.

Fixed issues so far:

1. The generated loader originally omitted its final `DATA` record, causing
   `?OUT OF DATA ERROR IN 3080`. The generator now retains final BASIC records
   and emits a sentinel after the byte stream.
2. The first renderer omitted the `$0400` screen-RAM base. It wrote into low RAM,
   producing `?OVERFLOW ERROR IN 440`, scrolling glyphs, and SID pops. Addresses
   now target screen RAM `$0541`–`$06AE` and color RAM `$D941`–`$DAAE`.
3. The helper preserves temporary zero-page pointers and masks IRQs while using
   them.
4. Hybrid blink timing now uses a stable 30-jiffy default.

Remaining problem:

* The hybrid runs but its segment presentation does not yet match the original
  visually. The latest screenshot showed a valid clock and no memory-corruption
  symptoms, but the user reports the segments look wrong. Do **not** represent
  PR #4 as ready to merge.

## Build and validation commands

```sh
make basic      # documented token-preserving BASIC version
make fast       # pure BASIC performance version
make hybrid     # compile helper and create hybrid PRG
petcat -2 -o /tmp/listing.txt basic/shclock12-hybrid.prg
```

`make hybrid` requires `node`, VICE's `petcat`, `ca65`, and `ld65`. The generated
`assembly/segment-blitter.bin` is intentionally ignored; it is recreated from
the assembly source.

## Next-step plan

### 1. Make hybrid output exactly match BASIC (highest priority)

Do this before further speed work or the full assembly port.

1. Establish a repeatable comparison case: same RTC time, 24-hour mode, default
   segment theme, no burn offset, and a known four-digit display.
2. Capture screen RAM `$0400`–`$07E7` and color RAM `$D800`–`$DBE7` after that
   case in both `shclock12-fast.prg` and `shclock12-hybrid.prg`.
3. Compare only the seven segment rectangles. For each digit, verify the 62
   expected character/color cells, and confirm that off segments retain `E`
   while on segments use `C`.
4. Validate parameter transfer at BASIC line 650: `B`, signed `F`, `Q`, `R`, and
   `S1`–`S7` must agree with the helper's `$C300`–`$C30A` contract.
5. Compare all four segment themes (5–8), custom `H`/`V` characters, custom
   number/screen colours, leading-zero off, and every burn-protection offset.
6. Keep dot-matrix themes (9/0) on the original BASIC path; regression-test
   them after every hybrid change.

Only after these checks match should PR #4 be marked ready.

### 2. Measure the hybrid benefit

After correctness, compare the pure BASIC and hybrid builds on a real C64 or
VICE. Measure visible draw latency when a minute digit changes, not only average
clock timing. If the difference is not worthwhile, retain PR #3 as the optimized
BASIC endpoint and stop the hybrid experiment.

### 3. Full assembly implementation

Create a separate branch and PR after the hybrid decision. Port every original
feature before optimizing presentation:

1. TeensyROM RTC synchronization and C64 time conversion.
2. Four time-display modes.
3. Segment and dot-matrix renderers with all six themes and custom characters.
4. Keyboard input, validation, help/title screens, colours, text, leading zero,
   blink control, burn protection, and reset.
5. Device-8 theme save/load in a compatible format, or a documented migration
   if compatibility proves impossible.
6. Side-by-side behavior checks against the original BASIC program.

### 4. Analog dial version

Build this as a third program or selectable mode on top of the fully complete
assembly clock. It must retain every digital-clock feature; the dial is an added
option, not a replacement.

## Handoff notes

* Preserve the original PRG byte-for-byte. Generated editions should transform
  its BASIC line records rather than de-tokenizing and re-tokenizing PETSCII art.
* The original code has meaningful final BASIC records. The generator bug showed
  that a line whose next-pointer is zero is still a valid line and must be parsed.
* Do not use a full-screen blank as a redraw mask; the user found it distracting.
* Ask for screenshots from the real C64/TeensyROM setup when visual behavior
  differs from VICE. The RTC hardware path makes automated end-to-end testing
  less straightforward.
