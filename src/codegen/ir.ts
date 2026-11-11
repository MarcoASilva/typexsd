/**
 * Small intermediate representation of the TypeScript we generate. The
 * mapping rules build this; `print.ts` turns it into source text and
 * `print-zod.ts` into Zod schemas. Keeping the mapping apart from the
 * printers makes it testable without going through either.
 */

/** Facets / occurrence bounds the Zod printer can encode when asked to. */
export interface TypeConstraints {
    length?: number;
    minLength?: number;
    maxLength?: number;
    minInclusive?: number;
    maxInclusive?: number;
    minExclusive?: number;
    maxExclusive?: number;
    /** Each step is an OR-group; a value must match every step (XSD rule). */
    patterns?: string[][];
    minItems?: number;
    maxItems?: number;
}

type TsTypeBase =
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

export type TsType = TsTypeBase & { constraints?: TypeConstraints };

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

const hasConstraintValues = (c: TypeConstraints): boolean =>
    Object.values(c).some(
        v => v !== undefined && !(Array.isArray(v) && !v.length),
    );

/** Attach (or merge) constraints onto a type node for the Zod facet printer. */
export const withConstraints = (
    type: TsType,
    extra?: TypeConstraints,
): TsType => {
    if (!extra || !hasConstraintValues(extra)) return type;
    const merged: TypeConstraints = { ...type.constraints };
    for (const [key, value] of Object.entries(extra) as [
        keyof TypeConstraints,
        TypeConstraints[keyof TypeConstraints],
    ][]) {
        if (value !== undefined)
            (merged as Record<string, unknown>)[key] = value;
    }
    return hasConstraintValues(merged)
        ? { ...type, constraints: merged }
        : type;
};

export const schemaConstName = (typeName: string): string =>
    `${typeName}Schema`;
