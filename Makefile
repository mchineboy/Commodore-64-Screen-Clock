.PHONY: basic clean

basic: basic/shclock12-optimized.prg

basic/shclock12-optimized.prg: shclock12.prg tools/optimize-basic.mjs
	node tools/optimize-basic.mjs $< $@
	petcat -2 -o basic/shclock12-optimized.list $@

clean:
	rm -f basic/shclock12-optimized.prg basic/shclock12-optimized.list
