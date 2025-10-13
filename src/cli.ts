#!/usr/bin/env node
import { Command } from "commander";
import { bold, green, red, gray } from "colorette";
import path from "node:path";
import { loadCrieConfig } from "./config.js";
import { analyzeAngularLibrary } from "./analyzer.js";
import { emitReactIntrinsicDts } from "./emitter.js";

const program = new Command();

program
    .name("crie")
    .description("Generate React JSX intrinsic element typings from Angular Elements")
    .version("0.1.0");

program
    .command("react-types")
    .description("Scan Angular sources and emit React JSX intrinsic typings")
    .option("--config <path>", "path to crie.config.* directory (default: .)", ".")
    .action(async (opts) => {
        try {
            const cwd = path.resolve(process.cwd(), opts.config);
            const cfg = await loadCrieConfig(cwd);

            console.log(gray(`root: ${cfg.root}`));
            console.log(gray(`tsconfig: ${cfg.tsconfig}`));
            console.log(gray(`include: ${cfg.include.join(", ")}`));

            const analysis = analyzeAngularLibrary({
                root: cfg.root,
                tsconfig: cfg.tsconfig,
                include: cfg.include,
                exclude: cfg.exclude,
                tagPrefix: cfg.tagPrefix,
                widenPrimitivesToString: cfg.widenPrimitivesToString
            });

            if (!analysis.components.length) {
                console.log(red("No Angular components with kebab-case selectors found."));
                process.exitCode = 1;
                return;
            }

            const outPath = emitReactIntrinsicDts(
                analysis,
                path.resolve(cfg.root, cfg.outDir),
                cfg.outFile,
                { addReactHtmlAttributes: cfg.react.addReactHtmlAttributes }
            );

            console.log(bold(green(`✅ Generated ${outPath}`)));
        } catch (e: any) {
            console.error(red(e?.stack || e?.message || String(e)));
            process.exitCode = 1;
        }
    });

program.parseAsync();
