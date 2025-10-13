import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";

export const ConfigSchema = z.object({
    root: z.string().default(process.cwd()),
    tsconfig: z.string().default("tsconfig.json"),
    include: z.array(z.string()).default(["src/**/*.ts"]),
    exclude: z.array(z.string()).default([
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/*.d.ts",
        "**/node_modules/**",
        "**/dist/**"
    ]),
    tagPrefix: z.string().optional(),
    outDir: z.string().default("dist/elements/alo-kit"),
    outFile: z.string().default("global.d.ts"),
    widenPrimitivesToString: z.boolean().default(false),
    react: z.object({
        addReactHtmlAttributes: z.boolean().default(true),
        emitWrappers: z.boolean().default(false),
        wrapperDir: z.string().default("dist/react-wrappers")
    }).default({})
});

export type CrieUserConfig = z.infer<typeof ConfigSchema>;

export async function loadCrieConfig(cwd = process.cwd()): Promise<CrieUserConfig> {
    const explorer = cosmiconfig("crie", {
        searchPlaces: [
            "crie.config.json",
            "crie.config.ts",
            "crie.config.mjs",
            "crie.config.cjs",
            "package.json"
        ]
    });

    const res = await explorer.search(cwd);
    let raw: any = {};
    if (res?.filepath?.endsWith("package.json")) {
        raw = (res.config as any)?.crie ?? {};
    } else if (res?.config) {
        raw = res.config;
    }
    return ConfigSchema.parse(raw);
}
