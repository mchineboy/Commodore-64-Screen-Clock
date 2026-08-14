.PHONY: basic clean

basic: basic/shclock12-optimized.bas

basic/shclock12-optimized.bas: shclock12.bas tools/optimize-basic.mjs
	node tools/optimize-basic.mjs $< $@
	petcat -2 -o basic/shclock12-optimized.list $@

clean:
	rm -f basic/shclock12-optimized.bas basic/shclock12-optimized.list
