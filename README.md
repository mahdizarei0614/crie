# crie

Generate strongly typed React JSX intrinsic element declarations from Angular Elements (custom elements) libraries. `crie` inspects your Angular components—legacy `@Input()`/`@Output()` metadata and the new `input()`, `output()`, and `model()` signal APIs—to produce `.d.ts` files that make consuming Angular Elements in React ergonomic and type-safe.

<p align="center">
  <a href="https://www.npmjs.com/package/crie"><img alt="npm" src="https://img.shields.io/npm/v/crie.svg?style=flat-square"></a>
  <a href="https://github.com/mahdizarei0614/crie/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/mahdizarei0614/crie/ci.yml?style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square"></a>
</p>

---

- [Why crie?](#why-crie)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration reference](#configuration-reference)
- [CLI commands](#cli-commands)
- [Generated output](#generated-output)
- [React consumption patterns](#react-consumption-patterns)
- [Working with Angular signal inputs/outputs](#working-with-angular-signal-inputsoutputs)
- [Tips, limitations, and troubleshooting](#tips-limitations-and-troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Why crie?

Angular Elements let you publish Angular components as framework-agnostic custom elements. React, however, does not know anything about the inputs and outputs of those custom elements—TypeScript treats them as `JSX.IntrinsicElements['any']`, so you lose completion, validation, and documentation.

`crie` bridges that gap by reading your Angular source code (no need to run builds) and generating a `.d.ts` module that augments React's intrinsic elements. The resulting type declarations let you:

- See every input as a strongly typed JSX property in React editors.
- Wire event handlers (`onFoo`) with the right payload type.
- Keep parity between Angular signal-based inputs/outputs and React props without manual work.
- Share a single source of truth between Angular and React teams.

## Installation

```bash
# Local (recommended for workspace automation)
npm install --save-dev crie

# Or globally for quick experimentation
npm install --global crie
```

**Requirements**

- Node.js ≥ 18.18
- A working Angular library/project that exposes custom elements (selectors **must** be kebab-case).
- A TypeScript configuration file (`tsconfig.json`) that includes the components you want to analyze.

## Quick start

1. **Expose Angular components as elements.** Ensure the components you want to consume have kebab-case selectors, e.g. `selector: 'alo-counter'`.
2. **Add a configuration file** at your Angular workspace root (see [Configuration reference](#configuration-reference) for all options). For example:

   ```ts
   // crie.config.ts
   const config = {
     root: '.',
     tsconfig: 'tsconfig.lib.json',
     include: ['src/lib/**/*.ts'],
     outDir: 'dist/elements/alo-kit',
     outFile: 'react.d.ts',
     tagPrefix: 'alo-',
     react: {
       addReactHtmlAttributes: true
     }
   };

   export default config;
   ```
3. **Run the generator.**

   ```bash
   npx crie react-types --config .
   ```

   The command prints a summary of the config it resolved, scans your TypeScript sources, and writes a declaration file (by default `dist/elements/alo-kit/global.d.ts`).

4. **Tell React TypeScript projects about the declarations.** Reference the generated file from your React app's `tsconfig.json` via the `types` or `typeRoots` option, or import it once in a global ambient declarations file:

   ```ts
   // react-app/src/types/custom-elements.d.ts
   /// <reference types="../path-to/angular-lib/dist/elements/alo-kit/react" />
   ```

   Now `<alo-counter>` and any other exported element will have rich IntelliSense in React codebases.

## Configuration reference

`crie` relies on [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) to locate configuration. It searches upward from the provided `--config` directory for one of:

- `crie.config.ts`
- `crie.config.mjs`
- `crie.config.cjs`
- `crie.config.json`
- `package.json` (under the `"crie"` key)

Every option is optional thanks to defaults, but explicit configuration is recommended for clarity.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `root` | `string` | `process.cwd()` | Working directory for globbing and path resolution. |
| `tsconfig` | `string` | `"tsconfig.json"` | Path (relative to `root`) to the TypeScript config that describes your Angular sources. |
| `include` | `string[]` | `["src/**/*.ts"]` | Glob patterns (relative to `root`) to include when scanning. |
| `exclude` | `string[]` | `["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts", "**/node_modules/**", "**/dist/**"]` | Globs that are never analyzed. |
| `tagPrefix` | `string \| undefined` | `undefined` | Only emit components whose selectors start with this prefix; useful when a library exposes multiple element families. |
| `outDir` | `string` | `"dist/elements/alo-kit"` | Directory (relative to `root`) where the declaration file will be created; it is created if missing. |
| `outFile` | `string` | `"global.d.ts"` | File name for the generated declaration. |
| `widenPrimitivesToString` | `boolean` | `false` | When `true`, boolean/number inputs accept strings as well (e.g. to support HTML attribute semantics such as `'true'`). |
| `react.addReactHtmlAttributes` | `boolean` | `true` | Merge `React.HTMLAttributes<HTMLElement>` into every intrinsic element so standard DOM props (e.g. `className`, `onClick`) remain available. |
| `react.emitWrappers` | `boolean` | `false` | Reserved for future releases that emit ready-to-use React wrapper components. |
| `react.wrapperDir` | `string` | `"dist/react-wrappers"` | Target directory for future wrapper output; currently unused. |

### Using TypeScript configs

If your Angular library has a dedicated build config (e.g. `tsconfig.lib.json`), point `tsconfig` at that file. `crie` augments the project with any extra files matched by `include`, ensuring template-less libraries are still analyzed.

### Multiple packages

You can run `crie` multiple times with different configuration directories to generate declarations for several Angular element bundles in one monorepo.

## CLI commands

The CLI currently exposes a single command:

### `crie react-types`

Scan Angular source files and emit a React `.d.ts` module.

```
Usage: crie react-types [options]

Scan Angular sources and emit React JSX intrinsic typings

Options:
  --config <path>  path to crie.config.* directory (default: ".")
  -h, --help       display help for command
```

On success the command logs the generated file path. If no eligible components are found it exits with code `1` to help CI catch misconfigurations.

## Generated output

The declaration file contains two main pieces:

1. **Namespaced copies of complex types.** When an input/output references a non-primitive type from your library, `crie` captures the declaration and places it in a stable namespace like `AloTypes$abc12345`. This prevents leaking TS project internals while keeping references resolvable from React.
2. **`React.JSX.IntrinsicElements` augmentation.** For each Angular selector (filtered by `tagPrefix` if provided) `crie` emits an entry resembling:

   ```ts
   declare global {
     namespace React {
       namespace JSX {
         interface IntrinsicElements {
           'alo-counter': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
             & {
                 count?: number;
                 max?: number | undefined;
               }
             & {
                 onCountChange?: (e: CustomEvent<number>) => void;
               }
             & { children?: React.ReactNode };
         }
       }
     }
   }
   ```

Key behaviors to be aware of:

- Property names are deduced from `@Input()` aliases or signal property names.
- Events are exposed as `on${PascalCase(eventName)}` handlers accepting `CustomEvent<T>`.
- Two-way `model()` definitions emit both a prop (`foo`) and an event handler (`onFooChange`).
- When `widenPrimitivesToString` is enabled, boolean/number inputs accept either the primitive type or a string, mirroring how DOM attributes work.

## React consumption patterns

Once the `.d.ts` file is part of your React project's compilation, you can use the Angular Elements like any other intrinsic element:

```tsx
import '@alo-kit/elements/dist/elements/alo-kit/react';

export function Dashboard() {
  return (
    <section>
      <alo-counter
        count={5}
        max={10}
        onCountChange={(event) => {
          const next = event.detail;
          console.log('New count', next);
        }}
      />
    </section>
  );
}
```

Tips:

- If you rely on server-side rendering, ensure the underlying custom element bundle is loaded via `dynamic(() => import('...'), { ssr: false })` in Next.js or a similar mechanism.
- Because the declarations augment global JSX, you only need to import the generated file once (e.g. in your React entry point or a `types.d.ts` shim).

## Working with Angular signal inputs/outputs

Angular 17+ introduces `input()`, `output()`, and `model()` APIs for signal-based components. `crie` understands these patterns out of the box:

- `input<T>()` → produces a prop with type `T`.
- `model<T>()` → produces a prop with type `T` and an accompanying `on${Name}Change` handler.
- `output<T>()` → produces an event handler expecting `CustomEvent<T>`.

If you use `transform` helpers (e.g. `input.numberAttribute()`), `crie` infers reasonable fallback types. Combine this with `widenPrimitivesToString` when you want to accept both `number` and textual values.

## Tips, limitations, and troubleshooting

- **Selectors must be kebab-case.** Non kebab-case selectors are ignored because custom elements require a hyphen.
- **Template/type-only imports.** The analyzer normalizes Angular wrapper types (`InputSignal`, `Signal`, etc.) so the React side sees the unwrapped payload type.
- **Custom configs per package.** When sharing a repo between Angular and React, generate the declarations during the Angular package build (`npm run build && npx crie react-types`).
- **CI enforcement.** Add `npx crie react-types --config .` to your CI to ensure declarations stay up to date; the command exits non-zero if it cannot find any eligible components.
- **Debugging missing props.** Set `widenPrimitivesToString` to `false` temporarily and inspect the generated file—complex types are inlined or namespaced, so you can see exactly what `crie` inferred. Also confirm the component is included by your `include` globs.

## Contributing

Issues and pull requests are welcome! To hack on the project locally:

```bash
npm install
npm run build   # compile TypeScript with tsup
npm test        # (when tests are added)
```

See open issues for ideas or report bugs via [GitHub issues](https://github.com/mahdizarei0614/crie/issues).

## License

[MIT](LICENSE) © Mahdi Zarei (skyBlueDev)
