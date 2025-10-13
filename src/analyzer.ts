import { Project, SyntaxKind, ts, Node, ClassDeclaration, PropertyDeclaration, Decorator } from "ts-morph";
import { globSync } from "glob";
import path from "node:path";
import { normPath, shortHash, isKebabCustomElement } from "./utils.js";

export type TypeRef =
    | { kind: "inline"; text: string }
    | { kind: "ref"; fileId: string; exportName: string; declText: string };

export type InputProp = { name: string; type: TypeRef; optional: boolean; source: "legacy" | "signal" | "model" };
export type OutputEvt = { name: string; payload: TypeRef; source: "legacy" | "signal" | "model" };

export type ComponentDesc = {
    tag: string;
    inputs: InputProp[];
    outputs: OutputEvt[];
};

export type AnalysisResult = {
    components: ComponentDesc[];
    namespaces: Map<string, Map<string, string>>; // fileId -> exportName -> declText
};

type Cfg = {
    root: string;
    tsconfig: string;
    include: string[];
    exclude: string[];
    tagPrefix?: string;
    widenPrimitivesToString: boolean;
};

const TRANSFORM_MAP: Record<string, string> = {
    booleanAttribute: "boolean",
    numberAttribute: "number",
    stringAttribute: "string"
};

export function analyzeAngularLibrary(cfg: Cfg): AnalysisResult {
    const inc = cfg.include.flatMap(p => globSync(p, { cwd: cfg.root, ignore: cfg.exclude }));
    const project = new Project({
        tsConfigFilePath: path.resolve(cfg.root, cfg.tsconfig),
        skipAddingFilesFromTsConfig: false
    });
    // Add discovered files explicitly (helps when tsconfig is broad)
    inc.forEach(rel => project.addSourceFileAtPath(path.resolve(cfg.root, rel)));

    const checker = project.getTypeChecker();
    const namespaces = new Map<string, Map<string, string>>();
    const components: ComponentDesc[] = [];

    project.getSourceFiles().forEach(sf => {
        sf.getClasses().forEach(cls => {
            const comp = getAngularComponentTag(cls);
            if (!comp) return;
            const tags = comp
                .split(",")
                .map(s => s.trim())
                .filter(isKebabCustomElement)
                .filter(t => (cfg.tagPrefix ? t.startsWith(cfg.tagPrefix) : true));
            if (tags.length === 0) return;

            const inputs: InputProp[] = [];
            const outputs: OutputEvt[] = [];

            // class members: legacy decorators + signal/modeled props
            cls.getMembers().forEach(m => {
                // Legacy @Input/@Output on fields
                if (Node.isPropertyDeclaration(m) || Node.isGetAccessorDeclaration(m) || Node.isSetAccessorDeclaration(m)) {
                    const decos = ("getDecorators" in m ? (m as any).getDecorators() : []) as Decorator[];
                    const name = (m as any).getName?.() ?? "";
                    const type = (m as any).getType?.();

                    const inputDeco = decos.find(d => decoName(d) === "Input");
                    if (inputDeco) {
                        const alias = stringArg(inputDeco) ?? name;
                        const typeRef = resolveEffectiveTypeRef(type?.getText() ?? "unknown", m, checker, namespaces, cfg);
                        const optional = (m as any).hasQuestionToken?.() ?? false;
                        inputs.push({ name: alias, type: typeRef, optional, source: "legacy" });
                    }

                    const outputDeco = decos.find(d => decoName(d) === "Output");
                    if (outputDeco) {
                        // Try EventEmitter<T> or fallback to 'any'
                        const payload = extractEventEmitterPayload(m, checker) ??
                            (type ? type.getText() : "any");
                        const payloadRef = resolveEffectiveTypeRef(payload, m, checker, namespaces, cfg);
                        outputs.push({ name: name, payload: payloadRef, source: "legacy" });
                    }
                }

                // Signals: input()/output()/model()
                if (Node.isPropertyDeclaration(m)) {
                    const init = m.getInitializer();
                    if (init && Node.isCallExpression(init)) {
                        const callName = init.getExpression().getText();
                        if (callName === "input" || callName === "model") {
                            // type arg if present; else infer from transform
                            const generic = init.getTypeArguments()[0]?.getText();
                            const inferred = generic ?? inferTypeFromTransform(init) ?? "unknown";
                            const tRef = resolveEffectiveTypeRef(inferred, m, checker, namespaces, cfg);

                            const propName = m.getName();
                            const optional = !!m.hasQuestionToken();

                            inputs.push({ name: propName, type: tRef, optional, source: callName === "model" ? "model" : "signal" });

                            if (callName === "model") {
                                const evtName = `${propName}Change`;
                                outputs.push({ name: evtName, payload: tRef, source: "model" });
                            }
                        }
                        if (callName === "output") {
                            const generic = init.getTypeArguments()[0]?.getText() ?? "any";
                            const tRef = resolveEffectiveTypeRef(generic, m, checker, namespaces, cfg);
                            outputs.push({ name: m.getName(), payload: tRef, source: "signal" });
                        }
                    }
                }
            });

            for (const tag of tags) {
                components.push({ tag, inputs, outputs });
            }
        });
    });

    return { components, namespaces };
}

/* Helpers */

function getAngularComponentTag(cls: ClassDeclaration): string | undefined {
    const compDeco = cls.getDecorators().find(d => decoName(d) === "Component");
    if (!compDeco) return;
    const arg0 = compDeco.getCallExpression()?.getArguments()[0];
    if (!arg0 || !Node.isObjectLiteralExpression(arg0)) return;
    const sel = arg0.getProperty("selector");
    if (!sel || !Node.isPropertyAssignment(sel)) return;
    const init = sel.getInitializer();
    if (!init) return;
    if (Node.isStringLiteral(init)) return init.getLiteralText();
    // Handle template string literals (rare)
    if (init.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
        return init.getText().slice(1, -1);
    }
    return;
}

function decoName(d: Decorator): string | undefined {
    const expr = d.getExpression();
    if (Node.isCallExpression(expr)) {
        const id = expr.getExpression();
        return id.getText();
    }
    return expr.getText();
}

function stringArg(d: Decorator): string | undefined {
    const expr = d.getExpression();
    if (!Node.isCallExpression(expr)) return;
    const first = expr.getArguments()[0];
    if (first && Node.isStringLiteral(first)) return first.getLiteralText();
    return;
}

function extractEventEmitterPayload(m: PropertyDeclaration, checker: ReturnType<Project["getTypeChecker"]>): string | undefined {
    // Try type annotation like EventEmitter<T>
    const typeNode = m.getTypeNode();
    if (typeNode) {
        const txt = typeNode.getText();
        const m1 = txt.match(/EventEmitter<([^>]+)>/);
        if (m1) return m1[1].trim();
    }
    // Try initializer: new EventEmitter<T>()
    const init = m.getInitializer();
    if (init && Node.isNewExpression(init)) {
        const ta = init.getTypeArguments()[0]?.getText();
        if (ta) return ta;
    }
    // As fallback, use the property type text
    const t = (m as any).getType?.();
    if (t) return t.getText();
    return;
}

function inferTypeFromTransform(call: import("ts-morph").CallExpression): string | undefined {
    const arg = call.getArguments()[0];
    if (!arg || !Node.isObjectLiteralExpression(arg)) return;
    const tProp = arg.getProperty("transform");
    if (!tProp || !Node.isPropertyAssignment(tProp)) return;
    const id = tProp.getInitializer();
    if (!id) return;
    const name = id.getText().replace(/Attribute$/, "");
    return TRANSFORM_MAP[name] ?? undefined;
}

function resolveEffectiveTypeRef(
    typeText: string,
    contextNode: Node,
    checker: ReturnType<Project["getTypeChecker"]>,
    namespaces: Map<string, Map<string, string>>,
    cfg: Cfg
): TypeRef {
    // Quick wins: primitives and simple unions don’t need namespacing.
    if (isPrimitiveish(typeText)) {
        return { kind: "inline", text: widenIfNeeded(typeText, cfg) };
    }

    // Ask checker for the “apparent” type
    const t = (contextNode as any).getType?.();
    if (t) {
        // If TS prints literal/union nicely, just inline that.
        const printed = t.getText();
        if (printed && isReasonableInline(printed)) {
            return { kind: "inline", text: widenUnionIfNeeded(printed, cfg) };
        }
    }

    // Try to locate a declaration symbol to copy into a namespace
    const symbol = (contextNode as any).getSymbol?.() ?? t?.getSymbol?.();
    if (symbol) {
        const decl = symbol.getDeclarations()?.[0];
        if (decl) {
            const sf = decl.getSourceFile();
            const fileId = shortHash(normPath(sf.getFilePath()));
            const exportName = symbol.getName().replace(/["']/g, "");
            // Ensure namespace bucket
            if (!namespaces.has(fileId)) namespaces.set(fileId, new Map());
            const bucket = namespaces.get(fileId)!;

            if (!bucket.has(exportName)) {
                // Capture a reconstructable text (exported)
                let text = decl.getText();
                // Ensure "export" exists on captured declaration
                if (!/^export\s/.test(text)) {
                    text = "export " + text;
                }
                bucket.set(exportName, text);
            }
            return { kind: "ref", fileId, exportName, declText: "" };
        }
    }

    // Last resort: inline raw text
    return { kind: "inline", text: widenIfNeeded(typeText || "unknown", cfg) };
}

function isPrimitiveish(s: string): boolean {
    return /^(string|number|boolean|any|unknown|void|null|undefined)(\[\])?$/.test(s.trim());
}

function isReasonableInline(s: string): boolean {
    // Avoid inlining absurdly large mapped/conditional types
    return s.length <= 300 && (s.includes("|") || s.includes("{") || isPrimitiveish(s));
}

function widenIfNeeded(s: string, cfg: Cfg): string {
    if (!cfg.widenPrimitivesToString) return s;
    if (s === "boolean") return "boolean | string";
    if (s === "number") return "number | string";
    return s;
}

function widenUnionIfNeeded(s: string, cfg: Cfg): string {
    if (!cfg.widenPrimitivesToString) return s;
    // widen inside unions like boolean | 'yes'
    return s.replace(/\bboolean\b/g, "boolean | string").replace(/\bnumber\b/g, "number | string");
}
