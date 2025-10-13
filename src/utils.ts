import path from "node:path";
import crypto from "node:crypto";

export function shortHash(input: string): string {
    return crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
}

export function normPath(p: string): string {
    return path.resolve(p).replace(/\\/g, "/");
}

export function isKebabCustomElement(tag: string): boolean {
    return /^[a-z][a-z0-9.-]*-[a-z0-9.-]+$/.test(tag);
}

export function capitalize(s: string): string {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function ensureDirSync(fs: typeof import("node:fs"), dir: string): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
