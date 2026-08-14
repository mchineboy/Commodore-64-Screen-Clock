#!/usr/bin/env node
/* Prove that assembly/segment-blitter.bin writes exactly the screen and colour
 * RAM cells that the original BASIC lines 650-700 write.
 *
 * The BASIC renderer is the specification:
 *
 *   650 d=b*10:v1=320+d+f:v2=520+d+f:v3=282+d+f:v4=482+d+f:v5=682+d+f
 *   660 forx=1to160step40
 *   670 pokez+v1+x,s1:pokel+v1+x,r:pokez+v1+x+6,s2:pokel+v1+x+6,r
 *   680 pokez+v2+x,s3:pokel+v2+x,r:pokez+v2+x+6,s4:pokel+v2+x+6,r:next
 *   690 forx=.to4:pokez+v3+x,s5:pokel+v3+x,q:pokez+v4+x,s6:pokel+v4+x,q
 *   700 pokez+v5+x,s7:pokel+v5+x,q:next
 *
 * with l=1024 ($0400) and z=55296 ($D800).
 */
import { readFileSync } from "node:fs";

const HELPER = process.argv[2] ?? "assembly/segment-blitter.bin";
const LOAD = 0xc000;
const PARAMS = 0xc300;
const SCREEN = 0x0400;
const COLOR = 0xd800;

/* ---------- the BASIC specification ---------- */

function basicCells({ b, f, q, r, s }) {
  const cells = new Map(); // address -> byte
  const put = (address, value) => cells.set(address, value);
  const d = b * 10;
  const [v1, v2, v3, v4, v5] = [320, 520, 282, 482, 682].map((v) => v + d + f);
  for (let x = 1; x <= 160; x += 40) {
    put(COLOR + v1 + x, s[0]);      put(SCREEN + v1 + x, r);
    put(COLOR + v1 + x + 6, s[1]);  put(SCREEN + v1 + x + 6, r);
    put(COLOR + v2 + x, s[2]);      put(SCREEN + v2 + x, r);
    put(COLOR + v2 + x + 6, s[3]);  put(SCREEN + v2 + x + 6, r);
  }
  for (let x = 0; x <= 4; x++) {
    put(COLOR + v3 + x, s[4]); put(SCREEN + v3 + x, q);
    put(COLOR + v4 + x, s[5]); put(SCREEN + v4 + x, q);
    put(COLOR + v5 + x, s[6]); put(SCREEN + v5 + x, q);
  }
  return cells;
}

/* ---------- just enough 6502 to run the helper ---------- */

function run(memory, start, writes) {
  let a = 0, y = 0, pc = start, carry = 0, negative = 0, zero = 0;
  const stack = [];
  const rd = (address) => memory[address & 0xffff];
  const wr = (address, value) => {
    memory[address & 0xffff] = value & 0xff;
    writes.set(address & 0xffff, value & 0xff);
  };
  const byte = () => rd(pc++);
  const word = () => { const low = byte(); return low | (byte() << 8); };
  const setNZ = (value) => { negative = (value >> 7) & 1; zero = value === 0 ? 1 : 0; return value; };
  const branch = (take) => { const offset = (byte() << 24) >> 24; if (take) pc = (pc + offset) & 0xffff; };
  const indirectY = () => { const zp = byte(); return (rd(zp) | (rd(zp + 1) << 8)) + y; };

  for (let steps = 0; steps < 1_000_000; steps++) {
    const opcode = byte();
    switch (opcode) {
      case 0x78: case 0x58: break;                                  // SEI / CLI
      case 0x18: carry = 0; break;                                  // CLC
      case 0x38: carry = 1; break;                                  // SEC
      case 0xa9: a = setNZ(byte()); break;                          // LDA #
      case 0xa5: a = setNZ(rd(byte())); break;                      // LDA zp
      case 0xad: a = setNZ(rd(word())); break;                      // LDA abs
      case 0xa0: y = setNZ(byte()); break;                          // LDY #
      case 0xc8: y = setNZ((y + 1) & 0xff); break;                  // INY
      case 0x85: wr(byte(), a); break;                              // STA zp
      case 0x8d: wr(word(), a); break;                              // STA abs
      case 0x91: wr(indirectY(), a); break;                         // STA (zp),y
      case 0x0a: carry = (a >> 7) & 1; a = setNZ((a << 1) & 0xff); break; // ASL A
      case 0x69: case 0x6d: {                                       // ADC # / abs
        const operand = opcode === 0x69 ? byte() : rd(word());
        const sum = a + operand + carry;
        carry = sum > 0xff ? 1 : 0;
        a = setNZ(sum & 0xff);
        break;
      }
      case 0xe9: {                                                  // SBC #
        const difference = a - byte() - (1 - carry);
        carry = difference >= 0 ? 1 : 0;
        a = setNZ(difference & 0xff);
        break;
      }
      case 0xce: { const address = word(); wr(address, setNZ((rd(address) - 1) & 0xff)); break; } // DEC abs
      case 0xee: { const address = word(); wr(address, setNZ((rd(address) + 1) & 0xff)); break; } // INC abs
      case 0x10: branch(!negative); break;                          // BPL
      case 0x90: branch(!carry); break;                             // BCC
      case 0x20: { const target = word(); stack.push(pc); pc = target; break; } // JSR
      case 0x60: if (!stack.length) return; pc = stack.pop(); break;           // RTS
      default:
        throw new Error(`unimplemented opcode $${opcode.toString(16)} at $${(pc - 1).toString(16)}`);
    }
  }
  throw new Error("helper did not return");
}

function helperCells(helper, { b, f, q, r, s }) {
  const memory = new Uint8Array(0x10000);
  memory.set(helper, LOAD);
  memory[PARAMS] = b;
  memory[PARAMS + 1] = f + 128;   // BASIC line 650 pokes f+128
  memory[PARAMS + 2] = q;
  memory[PARAMS + 3] = r;
  s.forEach((value, index) => { memory[PARAMS + 4 + index] = value; });
  memory[0x02] = 0x11; memory[0x03] = 0x22; memory[0x04] = 0x33; memory[0x05] = 0x44;

  const before = memory.slice();
  const cells = new Map();
  run(memory, LOAD, cells);

  // The helper borrows $02-$05; it must hand them back exactly as it found them.
  const zeroPage = [0x02, 0x03, 0x04, 0x05].filter((address) => memory[address] !== before[address]);
  return { cells, zeroPage };
}

/* ---------- cases ---------- */

const BURN_OFFSETS = [0, -79, -40, -39, -80, 1, 40, 41]; // BASIC lines 1350-1420
const THEMES = [                                          // q, r, c, e from lines 140 and 810-840
  { name: "default",  q: 224, r: 224, on: 13, off: 0 },
  { name: "theme 5",  q: 67,  r: 66,  on: 1,  off: 0 },
  { name: "theme 6",  q: 250, r: 250, on: 0,  off: 11 },
  { name: "theme 7",  q: 81,  r: 81,  on: 2,  off: 0 },
  { name: "theme 8",  q: 232, r: 220, on: 12, off: 0 },
  { name: "custom hv", q: 90, r: 91,  on: 15, off: 6 },  // H/V custom characters
];
const DIGITS = [                                          // BASIC lines 540-640
  [1, 1, 1, 1, 1, 0, 1], [0, 1, 0, 1, 0, 0, 0], [0, 1, 1, 0, 1, 1, 1],
  [0, 1, 0, 1, 1, 1, 1], [1, 1, 0, 1, 0, 1, 0], [1, 0, 0, 1, 1, 1, 1],
  [1, 0, 1, 1, 1, 1, 1], [0, 1, 0, 1, 1, 0, 0], [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0],
];

const helper = readFileSync(HELPER);
const failures = [];
let checked = 0;

for (const theme of THEMES) {
  for (const f of BURN_OFFSETS) {
    for (let b = 0; b <= 3; b++) {
      for (const segments of DIGITS) {
        const s = segments.map((on) => (on ? theme.on : theme.off));
        const testCase = { b, f, q: theme.q, r: theme.r, s };
        const expected = basicCells(testCase);
        const { cells: actual, zeroPage } = helperCells(helper, testCase);
        checked++;

        const label = `${theme.name} f=${f} digit-position=${b} segments=${segments.join("")}`;
        if (zeroPage.length) {
          failures.push(`${label}: zero page ${zeroPage.map((z) => "$0" + z).join(",")} not restored`);
        }
        for (const [address, value] of expected) {
          if (!actual.has(address)) {
            failures.push(`${label}: $${address.toString(16)} never written (expected ${value})`);
          } else if (actual.get(address) !== value) {
            failures.push(`${label}: $${address.toString(16)} = ${actual.get(address)}, expected ${value}`);
          }
        }
        for (const address of actual.keys()) {
          if (address <= 0x05 || (address >= LOAD && address < LOAD + helper.length)) continue;
          if (!expected.has(address)) {
            failures.push(`${label}: stray write to $${address.toString(16)} = ${actual.get(address)}`);
          }
        }
      }
    }
  }
}

const shown = failures.slice(0, 20);
if (failures.length) {
  console.error(`FAIL ${failures.length} mismatch(es) over ${checked} cases:`);
  for (const failure of shown) console.error("  " + failure);
  if (failures.length > shown.length) console.error(`  ...and ${failures.length - shown.length} more`);
  process.exit(1);
}
console.log(`OK  helper matches BASIC lines 650-700 across ${checked} cases`);
