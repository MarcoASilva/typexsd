/**
 * Small intermediate representation of the TypeScript we generate. The
 * mapping rules build this; `print.ts` turns it into source text. Keeping the
 * two apart makes the mapping testable without going through a printer.
 */

export type TsType =
    | {
          k: 'keyword';
          name: 'string' | 'number' | 'boolean' | 'unknown' | 'never';
      }
    | { k: 'null' }
    | { k: 'ref'; name: string }
    | { k: 'literal'; value: string | number | boolean }
    | { k: 'array'; of: TsType }
    | { k: 'union'; types: TsType[] }
    | { k: 'intersection'; types: TsType[] }
    | { k: 'object'; members: TsMember[]; index?: TsType };

export interface TsDoc {
    /** Free text, one entry per paragraph. */
    text: string[];
    /** `@tag value` lines. */
    tags: string[];
}

export interface TsMember {
    name: string;
    optional: boolean;
    type: TsType;
    doc?: TsDoc;
}

export type TsDecl =
    | {
          k: 'interface';
          name: string;
          extends: string[];
          members: TsMember[];
          index?: TsType;
          doc?: TsDoc;
      }
    | { k: 'alias'; name: string; type: TsType; doc?: TsDoc };

export const keyword = (
    name: 'string' | 'number' | 'boolean' | 'unknown' | 'never',
): TsType => ({ k: 'keyword', name });

export const ref = (name: string): TsType => ({ k: 'ref', name });

export const literal = (value: string | number | boolean): TsType => ({
    k: 'literal',
    value,
});

export const arrayOf = (of: TsType): TsType => ({ k: 'array', of });

const typeKey = (t: TsType): string => JSON.stringify(t);

export const union = (types: TsType[]): TsType => {
    const flat: TsType[] = [];
    for (const t of types) {
        if (t.k === 'union') flat.push(...t.types);
        else flat.push(t);
    }
    const seen = new Set<string>();
    const unique = flat.filter(t => {
        const key = typeKey(t);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    if (unique.length === 0) return keyword('never');
    if (unique.length === 1) return unique[0];
    return { k: 'union', types: unique };
};

export const intersection = (types: TsType[]): TsType => {
    const flat: TsType[] = [];
    for (const t of types) {
        if (t.k === 'intersection') flat.push(...t.types);
        else flat.push(t);
    }
    if (flat.length === 1) return flat[0];
    return { k: 'intersection', types: flat };
};

export const objectType = (members: TsMember[], index?: TsType): TsType => ({
    k: 'object',
    members,
    index,
});

export const isEmptyObject = (t: TsType): boolean =>
    t.k === 'object' && t.members.length === 0 && !t.index;
