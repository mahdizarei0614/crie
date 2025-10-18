# crie

![npm version](https://img.shields.io/npm/v/crie.svg) ![license](https://img.shields.io/npm/l/crie.svg)

Generate fully-typed React JSX intrinsic element definitions straight from your Angular Elements library.
`crie` scans Angular components (legacy decorators *and* the new signal-based APIs) and emits
a `global.d.ts` file that teaches TypeScript exactly which props and events each custom element
accepts when you render it from React.

> **Why?**
> Angular Elements expose web components, but React’s JSX does not know about their inputs or
> outputs. `crie` bridges that gap so you can consume Angular design systems and component
> libraries from React with first-class IntelliSense, type-checking, and event safety.

---

## Highlights

- ✅ **Understands both worlds** – parses Angular metadata (decorators, `input()`, `output()`, `model()`) and emits React-ready typings.
- ⚡ **Drop-in CLI** – run `npx crie react-types` in your Angular workspace and get a ready-to-publish `.d.ts` file.
- 🎯 **Highly configurable** – customize root paths, glob patterns, tag prefixes, output locations, and how primitive types widen.
- ♻️ **Incremental-friendly** – generated file only depends on the component sources and can be re-run in CI or release pipelines.
- 🧠 **Namespace-safe** – complex types are automatically hoisted into stable `declare namespace` blocks to avoid duplication.
- 🧪 **Great DX** – opt-in React HTML attribute merging, automatic `children` support, and predictable handler naming (`onFooChange`).

---

## Quick start

1. **Install (or use `npx`)**

   ```bash
   npm install --save-dev crie
   # or
   pnpm add -D crie
   ```

2. **Add a minimal config** (optional – defaults work for most Angular CLI libraries).

   ```ts
   // crie.config.ts
   import type { CrieUserConfig } from "crie";

   const config: CrieUserConfig = {
     root: __dirname,
     tsconfig: "tsconfig.lib.json",
     include: ["src/**/*.ts"],
     tagPrefix: "my-lib-",
     outDir: "dist/react-types",
     react: {
       addReactHtmlAttributes: true,
     },
   };

   export default config;
   ```

3. **Generate the typings**

   ```bash
   npx crie react-types
   # or provide an explicit configuration directory
   npx crie react-types --config projects/my-elements
   ```

4. **Consume from React**

   Reference the emitted file (by default `dist/elements/alo-kit/global.d.ts`) from your React
   project’s `tsconfig.json` – either include the directory or add it to `compilerOptions.typeRoots`.

   ```jsonc
   {
     "compilerOptions": {
       "typeRoots": ["./node_modules/@types", "../dist/react-types"]
     },
     "include": ["src"]
   }
   ```

   When you publish the generated file alongside your Angular Elements package, consumers receive
   the augmentation automatically. In local workspaces, restart your editor after updating the file
   so TypeScript picks up the new globals. You can now render `<my-lib-button label="Save"
   onAction={(e) => ...} />` in React with full IntelliSense and event typings.

---

## CLI usage

```bash
Usage: crie [options] [command]

Generate React JSX intrinsic element typings from Angular Elements

Options:
  -V, --version  output the version number
  -h, --help     display help for command

Commands:
  react-types [options]  Scan Angular sources and emit React JSX intrinsic typings
  help [command]         display help for command
```

`react-types` options:

| Flag            | Description                                                                         | Default |
| --------------- | ----------------------------------------------------------------------------------- | ------- |
| `--config <dir>`| Directory that contains `crie.config.*` or `package.json` with a `crie` section.    | `.`     |

The command resolves the configuration, analyzes Angular source files, and writes the generated `d.ts`
file. On success it prints the output path:

```
root: /path/to/projects/elements
tsconfig: tsconfig.lib.json
include: src/**/*.ts
✅ Generated dist/react-types/global.d.ts
```

If no kebab-case selectors are found, the CLI exits with a non-zero code and prints a diagnostic.

---

## Configuration

`crie` searches for configuration relative to `--config` in the following files (in order):

1. `crie.config.json`
2. `crie.config.ts`
3. `crie.config.mjs`
4. `crie.config.cjs`
5. `package.json` (`{ "crie": { ... } }`)

All options are validated via [zod](https://github.com/colinhacks/zod); missing values fall back to
sensible defaults.

| Option                           | Type                    | Default                        | Description |
| -------------------------------- | ----------------------- | ------------------------------ | ----------- |
| `root`                           | `string`                | current working directory      | Base directory used to resolve globs and the TypeScript project. |
| `tsconfig`                       | `string`                | `"tsconfig.json"`             | Path (relative to `root`) to the `tsconfig` that describes your Angular sources. |
| `include`                        | `string[]`              | `['src/**/*.ts']`              | Glob patterns that locate Angular components to analyse. |
| `exclude`                        | `string[]`              | test files, declarations, dist | Glob patterns ignored during analysis; tweak if you colocate stories or mocks. |
| `tagPrefix`                      | `string \| undefined`   | `undefined`                    | Restrict processing to selectors that start with this prefix (handy for monorepos). |
| `outDir`                         | `string`                | `"dist/elements/alo-kit"`     | Output folder for generated typings. Ensure it exists (created automatically if missing). |
| `outFile`                        | `string`                | `"global.d.ts"`               | File name for the generated declaration file. |
| `widenPrimitivesToString`        | `boolean`               | `false`                        | When `true`, widens `boolean`/`number` inputs to also accept `string` (useful for DOM attribute bindings). |
| `react.addReactHtmlAttributes`   | `boolean`               | `true`                         | Merge `React.HTMLAttributes<HTMLElement>` into each intrinsic element entry. Disable for pure web component contracts. |
| `react.emitWrappers`             | `boolean`               | `false`                        | Reserved for future wrapper generation support. Currently ignored. |
| `react.wrapperDir`               | `string`                | `"dist/react-wrappers"`       | Target directory for future wrapper output. |

### Example `crie.config.json`

```json
{
  "root": "projects/my-elements",
  "tsconfig": "tsconfig.lib.json",
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.spec.ts", "**/*.stories.ts"],
  "tagPrefix": "my-lib-",
  "outDir": "dist/react",
  "outFile": "intrinsic.d.ts",
  "widenPrimitivesToString": true,
  "react": {
    "addReactHtmlAttributes": true
  }
}
```

---

## What gets generated?

The output file augments `React.JSX.IntrinsicElements` with one entry per Angular component selector.
Each entry is an intersection of:

1. Optional React HTML attributes (configurable).
2. A props object derived from Angular inputs (legacy and signal-based).
3. Event handlers derived from Angular outputs / models (`onFoo`, `onFooChange`).
4. An object that enables `children` by default.

Example snippet:

```ts
/* Auto-generated by crie. Do not edit manually. */

declare namespace AloTypes$1a2b3c4d {
  export interface ButtonVariant {
    label: string;
    tone?: "neutral" | "success" | "danger";
  }
}

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'my-lib-button':
          React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> &
          {
            label: string;
            tone?: AloTypes$1a2b3c4d.ButtonVariant;
          } &
          {
            onAction?: (e: CustomEvent<string>) => void;
          } &
          { children?: React.ReactNode };
      }
    }
  }
}
```

Notice how complex types are hoisted into a `declare namespace AloTypes$...` block so they can be
referenced by name instead of inlining massive definitions everywhere.

---

## Angular feature coverage

- `@Component({ selector: '...' })` – supports multiple comma-separated selectors, filtered by
  kebab-case and optional prefix.
- Legacy field decorators: `@Input()`, `@Input('alias')`, `@Output()` (auto-detects
  `EventEmitter<T>` payloads via annotations or constructor arguments).
- Signals API: `input<T>()`, `output<T>()`, and `model<T>()` calls on class properties (including
  transforms such as `booleanAttribute`, `numberAttribute`, etc.).
- Angular signal wrappers (`InputSignal`, `ModelSignal`, etc.) are unwrapped before type emission.
- `model()` properties automatically create both the input prop and an `on${Name}Change` handler.

If you rely on additional metadata or encounter gaps, please open an issue or pull request.

---

## Integrating into your build

- **Type checking:** add the generated `.d.ts` file to your React app’s `tsconfig.include` or copy it
  into a package that React projects consume.
- **CI / release:** the package ships with a `prepare` script that runs `tsup`, so `npm publish`
  automatically bundles the CLI. You can run `npm run build && npx crie react-types` as part of your
  release pipeline to keep types in sync.
- **Watch mode:** use `npm run dev` (which runs `tsup --watch`) alongside your Angular build to
  regenerate typings whenever sources change.

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `No Angular components with kebab-case selectors found.` | Ensure your selectors are kebab-case (`my-comp`) and not just class selectors (`appFoo`). If you publish multiple selectors, set `tagPrefix` to the web component prefix. |
| `Cannot find module` errors | Verify `tsconfig` points at the Angular library project (and includes template `.ts` files). You may need to add `"skipLibCheck": false` in your config if using strict settings. |
| React still complains about unknown elements | Confirm that the generated `.d.ts` file is included in the React project’s TypeScript compilation (restart `tsserver` after updating). |
| Outputs are typed as `any` | Provide explicit `EventEmitter<T>` generics or `output<T>()` generics in your Angular component. `crie` uses them whenever available. |

---

## Contributing

Issues and pull requests are welcome! Please lint (`npm run lint`) and test (`npm test`) before
submitting. See the [MIT License](./LICENSE) for details on usage and redistribution.

---

## Release checklist

1. Update your Angular components / types.
2. Run `npx crie react-types` to refresh the declaration file.
3. Verify the generated output in your React consumer.
4. Publish to npm – the `files` field already includes `dist`, `README.md`, and `LICENSE`, so your
   documentation (this file!) appears both on GitHub and npm.

Enjoy typed Angular Elements in React! 🎉
