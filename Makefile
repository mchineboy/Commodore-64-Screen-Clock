.PHONY: basic fast hybrid verify clean

basic: basic/shclock12-optimized.prg

fast: basic/shclock12-fast.prg

hybrid: basic/shclock12-hybrid.prg

basic/shclock12-optimized.prg: shclock12.prg tools/optimize-basic.mjs
	node tools/optimize-basic.mjs $< $@
	petcat -2 -o basic/shclock12-optimized.list $@

basic/shclock12-fast.prg: shclock12.prg tools/build-fast-basic.mjs
	node tools/build-fast-basic.mjs $< $@
	petcat -2 -o basic/shclock12-fast.list $@

assembly/segment-blitter.bin: assembly/segment-blitter.s assembly/segment-blitter.cfg
	ca65 -o /tmp/segment-blitter.o assembly/segment-blitter.s
	ld65 -C assembly/segment-blitter.cfg -o $@ /tmp/segment-blitter.o

verify: assembly/segment-blitter.bin
	node tools/verify-blitter.mjs $<

basic/shclock12-hybrid.prg: shclock12.prg tools/build-fast-basic.mjs assembly/segment-blitter.bin tools/verify-blitter.mjs
	node tools/verify-blitter.mjs assembly/segment-blitter.bin
	node tools/build-fast-basic.mjs $< $@ assembly/segment-blitter.bin
	petcat -2 -o basic/shclock12-hybrid.list $@

clean:
	rm -f basic/shclock12-optimized.prg basic/shclock12-optimized.list basic/shclock12-fast.prg basic/shclock12-fast.list basic/shclock12-hybrid.prg basic/shclock12-hybrid.list assembly/segment-blitter.bin
