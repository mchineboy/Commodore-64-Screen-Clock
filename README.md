# Commodore 64 Screen Clock

[`shclock12.bas`](shclock12.bas) is Dad's original tokenized C64 BASIC V2 program.
It synchronizes the C64 software clock from a TeensyROM RTC, then draws a configurable
segment or dot-matrix clock.

## Optimized BASIC

Run `make basic` to create `basic/shclock12-optimized.bas` and a reviewable listing.
The optimized PRG preserves every original token and PETSCII byte, adds short `REM`
section labels, and removes the two unused scalar `DIM` statements at lines 110 and
120.  C64 BASIC creates scalar variables automatically, so this reduces both startup
work and program size without changing a feature.

The original on-disk name is preserved when the program itself saves a copy (`SAVE
"SHCLOCK12",8,1`); the Git filename is now correctly `.bas`.
