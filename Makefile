.PHONY: basic fast clean

basic: basic/shclock12-optimized.prg

fast: basic/shclock12-fast.prg

basic/shclock12-optimized.prg: shclock12.prg tools/optimize-basic.mjs
	node tools/optimize-basic.mjs $< $@
	petcat -2 -o basic/shclock12-optimized.list $@

basic/shclock12-fast.prg: shclock12.prg tools/build-fast-basic.mjs
	node tools/build-fast-basic.mjs $< $@
	petcat -2 -o basic/shclock12-fast.list $@

clean:
	rm -f basic/shclock12-optimized.prg basic/shclock12-optimized.list basic/shclock12-fast.prg basic/shclock12-fast.list
