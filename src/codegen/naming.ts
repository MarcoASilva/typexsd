import { pascalCase } from 'change-case';

/** Names the generated file must not redefine (globals we reference or shadow). */
const RESERVED = new Set([
    'Buffer',
    'Uint8Array',
    'Array',
    'Record',
    'Date',
    'String',
    'Number',
    'Boolean',
    'Object',
    'Function',
    'Symbol',
    'Promise',
    'Partial',
    'Required',
    'Readonly',
    'Map',
    'Set',
    'Error',
    'Exclude',
    'Extract',
    'Pick',
    'Omit',
    'NonNullable',
    'Parameters',
    'ReturnType',
    'Awaited',
    'Iterable',
    'Iterator',
    'RegExp',
]);

/** PascalCase an XML name into a valid TypeScript identifier. */
export const toTypeName = (name: string): string => {
    let id = pascalCase(name.replace(/#/g, ' '), {
        // keep digits attached to the preceding word: `foo2` -> `Foo2`
        stripRegexp: /[^A-Za-z0-9\u00C0-\uFFFF$]+/g,
    });
    if (!id) id = 'Type';
    if (/^[0-9]/.test(id)) id = `_${id}`;
    return id;
};

/**
 * Hands out unique type names. A name can be reserved up front (so that
 * top-level declarations win over nested anonymous ones) and later claimed.
 */
export class NameRegistry {
    private used = new Set<string>(RESERVED);

    claim(...candidates: string[]): string {
        for (const candidate of candidates) {
            const name = toTypeName(candidate);
            if (!this.used.has(name)) {
                this.used.add(name);
                return name;
            }
        }
        const base = toTypeName(candidates[candidates.length - 1]);
        let n = 2;
        while (this.used.has(`${base}${n}`)) n++;
        const name = `${base}${n}`;
        this.used.add(name);
        return name;
    }

    isTaken(name: string): boolean {
        return this.used.has(toTypeName(name));
    }
}
