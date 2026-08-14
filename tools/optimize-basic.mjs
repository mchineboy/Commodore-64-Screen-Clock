#!/usr/bin/env node
/*
 * Create the documented BASIC V2 edition without de-tokenizing its PETSCII
 * screen-art strings.  Re-tokenizing a text listing changes those bytes, so
 * this deliberately works on BASIC line records instead.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2] ?? "shclock12.prg";
const output = process.argv[3] ?? "basic/shclock12-optimized.prg";
const prg = readFileSync(input);
if (prg.readUInt16LE(0) !== 0x0801) throw new Error("Expected a C64 BASIC PRG at $0801");

const lines = [];
for (let pos = 2; pos + 4 <= prg.length;) {
  const next = prg.readUInt16LE(pos);
  const number = prg.readUInt16LE(pos + 2);
  if (!next && !number) break;   // zero link word: end-of-program marker
  let end = pos + 4;
  while (end < prg.length && prg[end] !== 0) end++;
  if (end === prg.length) throw new Error(`Unterminated BASIC line ${number}`);
  // These two DIM statements declare only scalars. BASIC V2 creates scalar
  // variables automatically, so removing them saves program bytes and startup.
  if (number !== 110 && number !== 120) lines.push({ number, body: prg.subarray(pos + 4, end) });
  if (next === 0) break;
  pos = next - 0x0801 + 2;
}

const rem = (number, text) => ({ number, body: Buffer.from([0x8f, 0x20, ...Buffer.from(text, "ascii")]) });
lines.push(
  rem(90, "STARTUP: TEENSYROM RTC -> C64 TI CLOCK"),
  rem(215, "MAIN DISPLAY LOOP: TIME, INPUT, AND BLINKING COLON"),
  rem(715, "KEYBOARD COMMANDS"),
  rem(1075, "REDRAW AFTER A SETTING CHANGE"),
  rem(1425, "SAVE/LOAD CUSTOM THEME ON DEVICE 8"),
  rem(1745, "TITLE SCREEN"),
  rem(2675, "VALIDATED INPUT ROUTINE")
);
lines.sort((a, b) => a.number - b.number);

// Every link points at the following record, and the program ends with a zero
// link word, exactly as a C64 SAVE writes it. petcat stops listing early
// without that terminator.
let address = 0x0801;
const records = [];
for (const line of lines) {
  const size = 2 + 2 + line.body.length + 1;
  const record = Buffer.alloc(size);
  record.writeUInt16LE(address + size, 0);
  record.writeUInt16LE(line.number, 2);
  line.body.copy(record, 4);
  records.push(record);
  address += size;
}
records.push(Buffer.alloc(2));
mkdirSync(output.slice(0, output.lastIndexOf("/")), { recursive: true });
writeFileSync(output, Buffer.concat([prg.subarray(0, 2), ...records]));
