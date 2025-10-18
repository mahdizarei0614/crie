# crie

> Generate React JSX intrinsic element typings from Angular Elements libraries — supports both legacy `@Input`/`@Output` and the new signal-driven APIs.

`crie` is a zero-runtime CLI that scans your Angular Elements package and emits strongly typed `global.d.ts` files for React. The resulting declaration file augments `React.JSX.IntrinsicElements`, enabling JSX autocomplete, type-checking, and documentation for every custom element your Angular team ships.

- ✅ Understands Angular component selectors, including multiple selectors per class.
- ✅ Collects legacy decorators (`@Input`, `@Output`) *and* the latest `input()`, `output()`, and `model()` signal helpers.
- ✅ Lifts referenced types into ambient namespaces so React consumers see the real types, not `any`.
- ✅ Optional widening for primitive inputs (`boolean`/`number`) to ease ergonomic string bindings in JSX.
- ✅ Generates idiomatic React prop names such as `onFooChange` for emitted custom events.

## Quick start

```bash
# Install as a development dependency
npm install --save-dev crie

# Or run the generator via npx
npx crie react-types
```

Running the command writes (by default) `dist/elements/alo-kit/global.d.ts`. Ship this file with your package and TypeScript-aware React apps will automatically pick up typings once the `.d.ts` file is included in their compilation (for example by being published alongside your custom elements package).

### Minimal Angular example

```ts
// button.component.ts
@Component({
  selector: 'alo-button'
})
export class ButtonComponent {
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Output() clicked = new EventEmitter<string>();

  state = model('ready');
}
```

`crie` turns this into the following JSX typing entry:

```ts
// dist/elements/alo-kit/global.d.ts

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'alo-button':
          React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> &
          {
            variant?: 'primary' | 'secondary';
            state?: string;
          } &
          {
            onClicked?: (e: CustomEvent<string>) => void;
            onStateChange?: (e: CustomEvent<string>) => void;
          } &
          { children?: React.ReactNode };
      }
    }
  }
}
```

When a React consumer writes `<alo-button variant="secondary" onClicked={(event) => ...} />`, the TypeScript compiler verifies prop names and event payloads based on this generated declaration.

## Installation

Add `crie` as a development dependency:

```bash
npm install --save-dev crie
# or
pnpm add -D crie
# or
yarn add -D crie
```

Because the CLI reads your Angular source with the TypeScript compiler API, Node.js 18.18 or newer is required.

## Usage

The CLI exposes a single command:

```bash
crie react-types [--config ./path/to/config]
```

| Option | Description | Default |
| --- | --- | --- |
| `--config <path>` | Directory that contains your `crie.config.*` file or a `package.json` with a `crie` key. | `.` (current working directory) |

### Typical workflow

1. **Create a config file** next to your Angular Elements package (see [Configuration](#configuration-reference)).
2. **Add an npm script** to regenerate typings before publishing:
   ```json
   {
     "scripts": {
       "build": "ng build",
       "react-types": "crie react-types",
       "prepare": "npm run build && npm run react-types"
     }
   }
   ```
3. **Publish** the generated `dist/elements/.../global.d.ts` file alongside your custom elements package so React consumers gain typings automatically.

If you do not want to install the binary globally, use `npx`/`pnpm dlx`/`yarn dlx` in CI pipelines:

```bash
npx crie react-types --config packages/alo-kit
```

## Configuration reference

`crie` reads configuration via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig). Place any of the supported files in your project root or the directory passed through `--config`:

- `crie.config.json`
- `crie.config.ts` (ESM)
- `crie.config.mjs`
- `crie.config.cjs`
- `package.json` (`{ "crie": { ... } }`)

Every field is optional—omitted keys fall back to the defaults shown below.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `root` | `string` | `process.cwd()` | Filesystem root that glob patterns and output paths resolve against. Useful when config lives in a monorepo workspace. |
| `tsconfig` | `string` | `"tsconfig.json"` | Path to the TypeScript configuration that describes your Angular library. All discovered files are added to this program for type analysis. |
| `include` | `string[]` | `["src/**/*.ts"]` | Glob patterns (relative to `root`) that locate Angular components to analyse. |
| `exclude` | `string[]` | `['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts', '**/node_modules/**', '**/dist/**']` | Additional ignore patterns. |
| `tagPrefix` | `string?` | `undefined` | When set, only selectors starting with this prefix are emitted. Handy when a single Angular package contains both element and component selectors. |
| `outDir` | `string` | `"dist/elements/alo-kit"` | Directory where the `.d.ts` file is written. Create a path that you already export in your package’s `files` array. |
| `outFile` | `string` | `"global.d.ts"` | File name to generate within `outDir`. |
| `widenPrimitivesToString` | `boolean` | `false` | When `true`, boolean and number inputs accept both their native type and strings (e.g. `boolean | string`) to mimic how JSX passes literal attributes. |
| `react.addReactHtmlAttributes` | `boolean` | `true` | If enabled, merges each intrinsic element with `React.HTMLAttributes<HTMLElement>` so consumers can still set ARIA attributes, `className`, etc. |
| `react.emitWrappers` | `boolean` | `false` | Reserved for future wrapper component generation. Currently unused. |
| `react.wrapperDir` | `string` | `"dist/react-wrappers"` | Target directory for future wrapper generation. |

### Example `crie.config.ts`

```ts
export default {
  root: __dirname,
  tsconfig: 'tsconfig.lib.json',
  include: ['src/lib/**/*.ts'],
  tagPrefix: 'alo-',
  outDir: 'dist/elements/alo-kit',
  outFile: 'global.d.ts',
  widenPrimitivesToString: true,
  react: {
    addReactHtmlAttributes: true
  }
};
```

> Tip: When authoring `crie.config.ts`, export a default object (ESM) or `module.exports = { ... }` (CommonJS). Type-checking the file is optional.

## How it works

1. **TypeScript analysis** – `crie` uses [`ts-morph`](https://ts-morph.com/) to spin up a TypeScript program using your `tsconfig`. This gives us precise knowledge of every component class, decorator, and signal helper.
2. **Component discovery** – only selectors in kebab-case (custom elements) are kept. If a component exposes multiple selectors, each becomes its own JSX entry.
3. **Prop extraction** – legacy decorators and signal helpers contribute props/events. `model()` props automatically create `on<Name>Change` handlers to match Angular’s two-way binding convention.
4. **Type lifting** – for complex types the generator copies declarations into ambient namespaces (e.g. `AloTypes$abc12345`). References in JSX props point to these namespaces so React consumers can import the same types if needed.
5. **Emission** – the final `global.d.ts` file declares React intrinsic elements, optionally intersected with `React.HTMLAttributes` for ergonomic usage.

Because all logic happens at build time, React bundles stay untouched—no runtime cost, no extra wrapper components.

## Integrating with React apps

1. Publish the generated declaration file with your Angular Elements package (ensure it is listed in `package.json` → `files`).
2. In the React project, install the package and make sure TypeScript picks up the declarations. When using `tsconfig.json`, add the package to `typeRoots` or simply rely on automatic discovery from `node_modules`.
3. Optionally augment JSX namespace yourself by referencing the generated file:
   ```ts
   /// <reference types="alo-kit/dist/elements/alo-kit" />
   ```
4. Start authoring `<alo-*>` elements with full IntelliSense.

## Troubleshooting

- **No components found** – ensure your selectors are kebab-case (`alo-button`). Class-only selectors (`ButtonComponent`) are intentionally ignored because they are not valid custom elements.
- **Missing props** – double check that the property is decorated with `@Input()` / `@Output()` or created via `input()`, `output()`, or `model()`. Private members are ignored by Angular and by `crie`.
- **Strange type names** – when TypeScript emits wrapped types (`ReadonlySignal<InputSignal<string>>`), `crie` attempts to unwrap them. If you still see wrappers, file an issue with a reproduction.
- **React complains about string boolean attributes** – enable `widenPrimitivesToString` so `checked="true"` is accepted alongside `checked={true}`.
- **Custom elements require React HTML attributes** – keep `react.addReactHtmlAttributes` enabled to inherit built-in attribute types. Disable it if you prefer a strict whitelist of component inputs/events.

## FAQ

### Does `crie` modify my source files?
No. It only reads your TypeScript AST and writes `.d.ts` files.

### Can I generate per-component React wrappers?
Not yet. The configuration surface contains `react.emitWrappers`/`react.wrapperDir` for forward compatibility, but wrapper generation is not implemented in v0.1.x.

### Can I run `crie` in CI?
Absolutely. The CLI is deterministic and can run wherever Node.js 18.18+ is available. Add `crie react-types` to your build pipeline after the Angular compilation step.

## Contributing

Found a bug or want a new feature? Please open an issue or PR on [GitHub](https://github.com/mahdizarei0614/crie). Development scripts:

```bash
npm install
npm run lint
npm run test
npm run build
```

## License

MIT © Mahdi Zarei (skyBlueDev)
