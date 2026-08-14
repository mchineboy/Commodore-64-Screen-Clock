# Project status — 2026-08-14 (updated)

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
| [#3](https://github.com/Hardison1958/Commodore-64-Screen-Clock/pull/3) | `codex/basic-fast-path` | Pure-BASIC fast edition: redraw only when the second changes. | Draft; depends on #1–#2. See the line 235 note below. |
| [#4](https://github.com/Hardison1958/Commodore-64-Screen-Clock/pull/4) | `codex/basic-hybrid-renderer` | Hybrid BASIC + 6502 segment renderer experiment. | Draft; close, but not yet correct. |

## Files and versions

| File | Purpose | Status |
| --- | --- | --- |
| `shclock12.prg` | Dad's preserved original tokenized BASIC V2 program. | Do not edit. |
| `basic/shclock12-optimized.prg` | Original with section `REM`s and redundant scalar `DIM`s removed. | Builds and lists correctly. |
| `basic/shclock12-fast.prg` | Pure-BASIC timed update loop. | The preferred optimized edition while hybrid is unfinished. |
| `basic/shclock12-hybrid.prg` | Fast BASIC plus a 6502 segment-drawing helper. | Segment output now matches BASIC cell-for-cell; needs hardware confirmation. |
| `tools/verify-blitter.mjs` | Interprets the helper and diffs its writes against the BASIC renderer. | 2112 cases pass. |
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

* Expensive time formatting and digit comparisons run only when `TI$` changes,
  normally once per second. This is the real saving in this edition.
* **The jiffy throttle was broken and is now fixed.** The single line
  `235 ifti=ltthen235:lt=ti` never waited. In CBM BASIC `THEN <line>` is a
  `GOTO`, so when the condition was true control jumped away and `lt=ti` never
  ran; when it was false the rest of the line was skipped and `lt=ti` never ran
  either. `lt` kept its initial `-1`, `ti=lt` was never true, and the loop
  free-ran. This is the same `IF ... THEN` trap that was fixed once elsewhere in
  this edition; line 235 was missed. The wait is now split across two records:

  ```basic
  235 ifti=ltthen235
  236 lt=ti
  ```

  Never put anything after `THEN <line>` on the same record.

* Measured in VICE with a reduced case
  (`20 ifti=ltthen20 : 25 lt=ti : 30 c=c+1:ifc<200then20`):

  | build | result |
  | --- | --- |
  | before | `lt=-1`, 200 iterations in 138 jiffies |
  | after | `lt=199`, 200 iterations in 200 jiffies |

  Exactly one pass per jiffy now. The old `lt=-1` reading is timing-independent,
  and warp mode did not affect it (137 jiffies with warp, 138 without).

* **The blink default is now `29`, replacing the `17` that was calibrated
  against the broken loop.** Line 340 compares `p>i` and resets on overflow, so
  the colon toggles every `i+1` passes; with the throttle working that is `i+1`
  jiffies, and a full on/off cycle is `2*(i+1)` jiffies. `i=29` gives a 60-jiffy
  cycle: 1.00 s on NTSC, 1.20 s on PAL. Confirmed in VICE at 121 jiffies for four
  toggles against a predicted 120, the extra jiffy being the initial partial one.
  For a PAL machine use `i=24`.
* Caveat for hardware calibration: once per second the heavy path runs (time
  formatting, printing, digit comparison, segment redraw) and can overrun a
  jiffy, so the observed cycle will be slightly longer than 60 jiffies. Confirm
  `29` by eye on the real C64 and adjust if it drifts long.
* The `:` command still overrides the rate at runtime, and a saved theme restores
  whatever rate it stored, since line 1500 writes `i`.
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
4. Hybrid and fast editions share the colon blink default of `17`.
5. **The "segments look wrong" report is explained and fixed.** The two
   right-hand vertical segments were one column too far left. BASIC line 670/680
   writes them at `v1+x+6` and `v2+x+6`, which are screen `$0547` and `$060F`;
   the helper used `$0546` and `$060E`, so those verticals landed inside the
   five-cell horizontal bars instead of flanking them. The digit geometry is
   columns 1 and 7 for the verticals, columns 2-6 for the bars.
6. **The BASIC generators omitted the two-byte end-of-program marker.** Both
   `optimize-basic.mjs` and `build-fast-basic.mjs` wrote a zero link word into
   the *last line's* record instead of appending a zero link word *after* it.
   That is not the form a C64 `SAVE` produces, and it has real consequences:
   `petcat -2` stops listing before the final line, and BASIC treats the final
   line as unreachable. In `shclock12-fast.prg` and `shclock12-optimized.prg`
   the final line is `3070 return`, ending the colour-chart subroutine that
   `2690 gosub2980` calls — so pressing a colour key (`C`, `@`, and any other
   `w1=0` prompt) printed the chart and then dropped the clock to `READY.`
   Verified in VICE with a minimal `gosub`/`return` pair built both ways: the
   zero-link build prints `SUB` then `READY.`, the terminated build prints
   `SUB` then `BACK`. The original `shclock12.prg` is correctly terminated and
   was never affected.

### Hybrid equivalence test

`tools/verify-blitter.mjs` is the repeatable comparison the plan below asked
for, without needing the RTC hardware in the loop. It interprets the real
`assembly/segment-blitter.bin` on a small 6502 model, logs every store, and
diffs the result against the BASIC lines 650-700 formulas over 2112 cases:
6 character/colour themes (defaults, themes 5-8, custom `H`/`V`) x 8 burn
offsets (`f` from lines 1350-1420) x 4 digit positions x 11 segment patterns
(digits 0-9 plus the all-off leading-zero case). It fails on a wrong cell, a
missing cell, a stray write outside the segment rectangles, or an unrestored
`$02`-`$05`. `make hybrid` runs it before building; `make verify` runs it alone.
It reproduces the off-by-one above as 67584 mismatches, so it is a real guard
rather than a tautology.

Remaining before PR #4 is merge-ready:

* Confirm on the real C64/TeensyROM setup across all four segment themes,
  custom characters/colours, leading-zero off, and every burn offset. VICE
  cannot exercise the RTC path.
* Regression-test the dot-matrix themes (9/0), which still use the BASIC path.
* Measure whether the hybrid is actually worth keeping (see below).

## Build and validation commands

```sh
make basic      # documented token-preserving BASIC version
make fast       # pure BASIC performance version
make verify     # helper output vs the BASIC renderer, 2112 cases
make hybrid     # verify, compile helper, and create hybrid PRG
petcat -2 -o /tmp/listing.txt basic/shclock12-hybrid.prg
```

`make hybrid` requires `node`, VICE's `petcat`, `ca65`, and `ld65`. The generated
`assembly/segment-blitter.bin` is intentionally ignored; it is recreated from
the assembly source.

## Next-step plan

### 1. Confirm hybrid output on real hardware (highest priority)

Steps 1–5 of the original plan are now covered by `make verify`, which compares
the helper's writes against the BASIC renderer over every theme, burn offset,
digit position, and segment pattern. What is left needs the real machine:

1. Run `shclock12-hybrid.prg` on the C64/TeensyROM and step through segment
   themes 5–8, custom `H`/`V` characters, custom number/screen colours,
   leading-zero off, and every burn-protection offset.
2. Regression-test the dot-matrix themes (9/0), which still use the BASIC path.
3. Confirm the ~4 second startup cost of `175 gosub3080` (POKEing 414 helper
   bytes from `DATA`) is acceptable, or move the helper into the PRG image.

Only after these checks should PR #4 be marked ready.

Automated coverage that is already in place:

```sh
make verify                        # helper vs BASIC, 2112 cases
x64sc -default -warp -autostart basic/shclock12-hybrid.prg \
      -keybuf "  " -keybuf-delay 300 -limitcycles 60000000 \
      -exitscreenshot /tmp/hybrid.png
```

VICE reaches the clock face because `PEEK(57014)` reads open bus (non-zero) and
the RTC wait at line 30 falls through. The clock therefore starts near 00:00 and
the RTC path itself is *not* exercised — that still needs hardware.

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
* A generated PRG must end the way `SAVE` ends one: every line link points at the
  following record, and a zero link word follows the last record. Putting the
  zero inside the last line's link instead makes that line unreachable and makes
  `petcat -2` truncate its listing — so a listing that looks fine can be hiding a
  dropped line. Check the tail of any new generator's output.
* Do not use a full-screen blank as a redraw mask; the user found it distracting.
* Ask for screenshots from the real C64/TeensyROM setup when visual behavior
  differs from VICE. The RTC hardware path makes automated end-to-end testing
  less straightforward.
