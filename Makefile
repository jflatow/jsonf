.PHONY: check doc test

check:
	deno check mod.ts

doc:
	deno doc mod.ts

test:
	deno test

