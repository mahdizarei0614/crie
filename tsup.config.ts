import { defineConfig } from "tsup";

export default defineConfig({
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    target: "node18",
    sourcemap: false,
    minify: false
});
