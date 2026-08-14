#!/usr/bin/env node
/* Build a faster, feature-equivalent C64 BASIC V2 clock without disturbing
 * the original PETSCII art.  Only the hot display-loop records are replaced. */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const input = process.argv[2] ?? "shclock12.prg";
const output = process.argv[3] ?? "basic/shclock12-fast.prg";

function readLines(prg) {
  if (prg.readUInt16LE(0) !== 0x0801) throw new Error("Expected a C64 BASIC PRG at $0801");
  const lines = [];
  for (let pos = 2; pos + 4 <= prg.length;) {
    const next = prg.readUInt16LE(pos);
    if (!next) break;
    const number = prg.readUInt16LE(pos + 2);
    let end = pos + 4;
    while (end < prg.length && prg[end] !== 0) end++;
    if (end === prg.length) throw new Error(`Unterminated BASIC line ${number}`);
    lines.push({ number, body: prg.subarray(pos + 4, end) });
    pos = next - 0x0801 + 2;
  }
  return lines;
}

function compileLines(source) {
  const dir = mkdtempSync(join(tmpdir(), "c64-clock-"));
  const text = join(dir, "lines.bas.txt");
  const prg = join(dir, "lines.prg");
  writeFileSync(text, source);
  const result = spawnSync("petcat", ["-w2", "-o", prg, text], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "petcat could not tokenize replacement lines");
  const lines = readLines(readFileSync(prg));
  rmSync(dir, { recursive: true, force: true });
  return lines;
}

function encode(lines) {
  lines.sort((a, b) => a.number - b.number);
  let address = 0x0801;
  const records = lines.map((line, index) => {
    const size = 5 + line.body.length;
    const record = Buffer.alloc(size);
    record.writeUInt16LE(index + 1 === lines.length ? 0 : address + size, 0);
    record.writeUInt16LE(line.number, 2);
    line.body.copy(record, 4);
    address += size;
    return record;
  });
  return Buffer.concat([Buffer.from([1, 8]), ...records]);
}

const replacementSource = `
150 m=2:cc=c:bn$="y":bn=ti:d$="24 hour":dm=.:n=c:m1=3:m2=8:lt=-1:ch=1:o$=""
220 printchr$(147):x=11:z(.)=x:z(1)=x:z(2)=x:z(3)=x:lt=-1:ch=1:o$=""
235 ifti=ltthen235:lt=ti
240 t$=ti$:ch=t$<>o$:ifch=.then330
241 o$=t$:poke646,e:onmgoto250,300,310,310
400 ifch=.then460
401 pokey+f,val(chr$(peek(l+6)))+48:pokev+f,n
`;
const replacement = new Map(compileLines(replacementSource).map((line) => [line.number, line]));
const original = readLines(readFileSync(input));
const outputLines = original
  .filter((line) => line.number !== 110 && line.number !== 120)
  .map((line) => replacement.get(line.number) ?? line);
// 235, 241, and 401 are new; the other replacement lines overwrite records.
outputLines.push(replacement.get(235), replacement.get(241), replacement.get(401));

const rem = (number, text) => ({ number, body: Buffer.from([0x8f, 0x20, ...Buffer.from(text, "ascii")]) });
outputLines.push(
  rem(90, "STARTUP: TEENSYROM RTC -> C64 TI CLOCK"),
  rem(234, "WAIT FOR NEXT JIFFY; FORMAT THE CLOCK ONCE PER SECOND"),
  rem(715, "KEYBOARD COMMANDS"),
  rem(1425, "SAVE/LOAD CUSTOM THEME ON DEVICE 8"),
  rem(1745, "TITLE SCREEN"),
  rem(2675, "VALIDATED INPUT ROUTINE")
);
mkdirSync(output.slice(0, output.lastIndexOf("/")), { recursive: true });
writeFileSync(output, encode(outputLines));
