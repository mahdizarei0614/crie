# crie

Generate strongly typed React JSX intrinsic element definitions from Angular Elements libraries. `crie` scans your Angular component sources, collects the available inputs and outputs (including the new `input()`, `output()`, and `model()` signal helpers), and emits `.d.ts` typings that let TypeScript-aware React tooling understand your custom elements.

> **Why "crie"?** It stands for **C**onvert **R**eact **I**ntrinsic **E**lements. Bring the ergonomics of JSX authoring to Angular Elements projects without manually writing declaration files.

## Table of contents

- [Highlights](#highlights)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Configuration](#configuration)
  - [Config file locations](#config-file-locations)
  - [Options](#options)
  - [Example configurations](#example-configurations)
- [CLI reference](#cli-reference)
- [Generated output](#generated-output)
- [Recipes](#recipes)
  - [Publishing typings with your package](#publishing-typings-with-your-package)
  - [Using the declarations in a React app](#using-the-declarations-in-a-react-app)
- [FAQ](#faq)
- [Development](#development)
- [License](#license)

## Highlights

- ✅ **Supports modern Angular signals** – understands `input()`, `output()`, and `model()` usage alongside classic `@Input()`/`@Output()` decorators.
- 🧭 **Smart type resolution** – re-exports referenced types into generated namespaces so JSX property types stay accurate.
- ⚙️ **Configurable discoverability** – point `crie` at any Angular workspace layout with glob `include`/`exclude` patterns.
- 💡 **React-friendly output** – generates `JSX.IntrinsicElements` definitions plus optional HTML attribute mixing for easy consumption in React.
- 🧱 **CLI-first workflow** – ship typings from CI/CD, package scripts, or local dev with a single command.

## Requirements

- Node.js **18.18 or newer** (matches the engine requirement declared in `package.json`).
- TypeScript project for your Angular Elements library. The CLI reads your `tsconfig.json` to understand source files and module resolution.

## Installation

`crie` can be installed globally or used through `npx`. For most projects, adding it as a dev dependency keeps everything versioned with your workspace.

```bash
# Local (recommended)
npm install --save-dev crie
# or
pnpm add -D crie
# or
yarn add --dev crie

# Global install (optional)
npm install --global crie
```

## Quick start

1. **Install the package** (see above).
2. **Create a `crie` config** (optional – defaults cover many setups). See [Configuration](#configuration) for details.
3. **Build your Angular components** so TypeScript metadata is up to date.
4. **Generate typings**:

   ```bash
   npx crie react-types
   ```

   Use `--config <path>` if your config lives outside the current directory.

5. **Ship the generated file** – usually under `dist/elements/alo-kit/global.d.ts` by default. Commit it or publish it with your package.

## How it works

`crie` walks your TypeScript project using [ts-morph](https://ts-morph.com/), reading Angular `@Component` metadata to find selectors that look like custom elements (`kebab-case`). For every component:

- Input sources:
  - Classic `@Input()` decorators on fields/getters/setters.
  - Signal-based `input()`/`model()` factory calls.
- Output sources:
  - Classic `@Output()` decorators.
  - Signal-based `output()` factories.
  - `model()` helpers create both an input and a corresponding `on<Name>Change` event.

`crie` resolves the TypeScript types for these members. When a type comes from another module, it records the declaration and re-exports it in a generated namespace (`AloTypes$<hash>`). Finally, it writes a `.d.ts` file that augments `React.JSX.IntrinsicElements` with your custom tags, merging:

- Optional React HTML attributes (configurable).
- Strongly typed props for inputs.
- Typed `CustomEvent` handlers for outputs (`onFoo` by convention).
- The standard `children` prop.

## Configuration

Configuration is fully optional. Without any file `crie` assumes:

- `root`: the current working directory
- `tsconfig`: `tsconfig.json`
- `include`: `['src/**/*.ts']`
- `exclude`: unit test files, declaration files, and build output
- `outDir`: `dist/elements/alo-kit`
- `outFile`: `global.d.ts`
- `react.addReactHtmlAttributes`: `true`
- `react.emitWrappers`: `false` (reserved for future use)
- `react.wrapperDir`: `dist/react-wrappers`

### Config file locations

`crie` uses [`cosmiconfig`](https://github.com/cosmiconfig/cosmiconfig) under the hood. It searches upward from the provided `--config` directory (default `.`) for:

- `crie.config.json`
- `crie.config.ts`
- `crie.config.mjs`
- `crie.config.cjs`
- `package.json` (`crie` key)

### Options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `root` | `string` | `process.cwd()` | Base directory for resolving paths. Useful when your config lives in a monorepo root but you need to target a package subdirectory. |
| `tsconfig` | `string` | `"tsconfig.json"` | Path (relative to `root`) to the TypeScript configuration that describes your Angular project. |
| `include` | `string[]` | `["src/**/*.ts"]` | Glob patterns (relative to `root`) to scan for Angular components. Use this to limit analysis to specific libraries. |
| `exclude` | `string[]` | See defaults above | Glob patterns to skip files (tests, generated output, etc.). |
| `tagPrefix` | `string \| undefined` | `undefined` | If provided, only selectors starting with this prefix are considered. Helpful when a library exports both elements and components. |
| `outDir` | `string` | `"dist/elements/alo-kit"` | Directory where the generated declaration file is written. |
| `outFile` | `string` | `"global.d.ts"` | File name for the generated declaration file. |
| `widenPrimitivesToString` | `boolean` | `false` | When `true`, primitive inputs are widened to `string` (handy if your elements are used declaratively in HTML where attributes are string-valued). |
| `react.addReactHtmlAttributes` | `boolean` | `true` | When `true`, each intrinsic element merges with `React.HTMLAttributes<HTMLElement>` so common props like `className` and `style` are available. Set to `false` if you want strictly custom inputs/outputs. |
| `react.emitWrappers` | `boolean` | `false` | Reserved for future wrapper generation. Currently unused by the CLI but accepted to avoid breaking config when the feature lands. |
| `react.wrapperDir` | `string` | `"dist/react-wrappers"` | Destination for future wrapper files. |

### Example configurations

<details>
<summary><strong>Basic JSON config</strong></summary>

```json
{
  "root": "packages/my-elements",
  "tsconfig": "tsconfig.lib.json",
  "include": ["src/**/*.ts"],
  "outDir": "dist/typings",
  "outFile": "elements.d.ts"
}
```
</details>

<details>
<summary><strong>TypeScript config with tag filtering</strong></summary>

```ts
import { defineConfig } from "crie/config"; // hypothetical helper, use plain object if not available

export default {
  root: __dirname,
  tsconfig: "tsconfig.lib.json",
  include: ["projects/storefront/src/**/*.ts"],
  tagPrefix: "my-app-",
  react: {
    addReactHtmlAttributes: true
  }
};
```
</details>

<details>
<summary><strong>`package.json` inline config</strong></summary>

```json
{
  "name": "my-elements",
  "version": "1.0.0",
  "crie": {
    "outDir": "dist/elements",
    "widenPrimitivesToString": true
  }
}
```
</details>

## CLI reference

### `crie react-types`

Scan your Angular project and emit React JSX intrinsic element typings.

```
Usage: crie react-types [options]

Options:
  --config <path>  path to crie.config.* directory (default: .)
  -h, --help       display help for command
```

The command prints the resolved config, processes your components, and writes the declaration file. If no qualifying components are found, it exits with status code `1`.

### Exit codes

- `0` – Success.
- `1` – No components matched or an error occurred.

## Generated output

The resulting declaration file (default `dist/elements/alo-kit/global.d.ts`) looks similar to:

```ts
/* Auto-generated by crie. Do not edit manually. */

declare namespace AloTypes$1a2b3c4d {
  interface ProductCardInput {
    /* ... */
  }
}

export {};
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'my-product-card':
          React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
          & {
              sku?: string;
              quantity?: number;
          }
          & {
              onAddToCart?: (e: CustomEvent<ProductPayload>) => void;
          }
          & { children?: React.ReactNode };
      }
    }
  }
}
```

Each component tag maps to an intersection type composed of:

1. Optional React HTML attributes (configurable).
2. A type literal for inputs (`@Input`, `input()`, etc.).
3. A type literal for outputs exposed as `on<EventName>` handlers returning `CustomEvent`.
4. `children?: React.ReactNode`.

## Recipes

### Publishing typings with your package

1. Add a build step before publishing:

   ```json
   {
     "scripts": {
       "prepublishOnly": "npm run build && crie react-types"
     }
   }
   ```

2. Ensure `dist` (or your configured directory) is included in the `files` array or `.npmignore`.
3. Publish as usual – the generated `global.d.ts` will appear on npm thanks to the entry in `package.json#files`.

### Using the declarations in a React app

1. Install your Angular Elements package.
2. Import the generated declaration file once in your app (or reference it via `types` in `package.json`). For global augmentations you can simply rely on TypeScript's automatic inclusion if the file lives inside `node_modules/<pkg>/dist/...`.
3. Start writing JSX with IntelliSense:

   ```tsx
   export const Example = () => (
     <my-product-card
       sku="SKU-42"
       quantity={2}
       onAddToCart={(e) => console.log(e.detail)}
     />
   );
   ```

TypeScript and editors now know the valid props and event payloads for your custom elements.

## FAQ

<details>
<summary><strong>Does it support standalone Angular components?</strong></summary>
Yes. As long as the component compiles with TypeScript and has a `selector` containing a kebab-case tag, `crie` can pick it up.
</details>

<details>
<summary><strong>What if multiple selectors are defined?</strong></summary>
All kebab-case selectors are emitted, so components exposing multiple custom elements will generate multiple entries sharing the same prop/event typings.
</details>

<details>
<summary><strong>How do I handle attribute coercion (boolean, number, etc.)?</strong></summary>
Use `widenPrimitivesToString: true` in your config to loosen the typings to `string`, matching how DOM attributes behave. Otherwise the original TypeScript type is preserved.
</details>

<details>
<summary><strong>What about wrapper generation?</strong></summary>
The config already includes `react.emitWrappers` and `react.wrapperDir` for forward compatibility. Today `crie` only emits `.d.ts` files, but wrappers may arrive in a future release without breaking your config.
</details>

## Development

To work on `crie` itself:

```bash
npm install
npm run build         # or npm run dev for watch mode
npm test              # powered by Vitest
```

Before publishing, `npm run release` bumps the patch version and publishes to npm.

## License

[MIT](./LICENSE) © Mahdi Zarei (skyBlueDev)
