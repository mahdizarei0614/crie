import { defineConfig } from "tsup";

export default defineConfig({
entry: { cli: "src/cli.ts" },
format: ["esm"],
dts: true,
clean: true,
target: "node18",
banner: { js: "#!/usr/bin/env node" },
sourcemap: false,
minify: false
});
