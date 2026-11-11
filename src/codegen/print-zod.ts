import {
    TsDecl,
    TsMember,
    TsType,
    TypeConstraints,
    schemaConstName,
} from './ir';

export interface PrintZodOptions {
    /** Encode XSD facets / occurrence bounds as Zod checks (default `false`). */
    encodeFacets?: boolean;
    /** First line(s) of the generated file. */
    header?: string;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const propKey = (name: string): string =>
    IDENTIFIER.test(name) ? name : JSON.stringify(name);

const lit = (value: string | number | boolean): string => {
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
};

/** Pattern steps: AND across steps, OR within a step. */
const patternSource = (step: string[]): string => {
    const body =
        step.length === 1
            ? `(?:${step[0]})`
            : `(?:${step.map(p => `(?:${p})`).join('|')})`;
    return JSON.stringify(`^(?:${body})$`);
};

const applyStringFacets = (expr: string, c: TypeConstraints): string => {
    let out = expr;
    if (c.length !== undefined) out += `.length(${c.length})`;
    if (c.minLength !== undefined) out += `.min(${c.minLength})`;
    if (c.maxLength !== undefined) out += `.max(${c.maxLength})`;
    if (c.patterns)
        for (const step of c.patterns)
            out += `.regex(new RegExp(${patternSource(step)}))`;
    return out;
};

const applyNumberFacets = (expr: string, c: TypeConstraints): string => {
    let out = expr;
    if (c.minInclusive !== undefined) out += `.min(${c.minInclusive})`;
    if (c.maxInclusive !== undefined) out += `.max(${c.maxInclusive})`;
    if (c.minExclusive !== undefined) out += `.gt(${c.minExclusive})`;
    if (c.maxExclusive !== undefined) out += `.lt(${c.maxExclusive})`;
    return out;
};

const applyArrayFacets = (expr: string, c: TypeConstraints): string => {
    let out = expr;
    if (c.minItems !== undefined) out += `.min(${c.minItems})`;
    if (c.maxItems !== undefined) out += `.max(${c.maxItems})`;
    if (c.length !== undefined) out += `.length(${c.length})`;
    return out;
};

const applyFacets = (expr: string, type: TsType, encode: boolean): string => {
    if (!encode || !type.constraints) return expr;
    const c = type.constraints;
    if (type.k === 'keyword' && type.name === 'string')
        return applyStringFacets(expr, c);
    if (type.k === 'keyword' && type.name === 'number')
        return applyNumberFacets(expr, c);
    if (type.k === 'array') return applyArrayFacets(expr, c);
    // Named decls carry facets on their own body; refs stay structural.
    return expr;
};
const knownSchemas = (decls: TsDecl[]): Set<string> =>
    new Set(decls.map(d => d.name));

const externalRef = (name: string): string => {
    if (name === 'Buffer') return 'z.instanceof(Buffer)';
    if (name === 'Date') return 'z.date()';
    return `z.custom<${name}>()`;
};

const printType = (
    type: TsType,
    schemas: Set<string>,
    encodeFacets: boolean,
): string => {
    let base: string;
    switch (type.k) {
        case 'keyword':
            base = {
                string: 'z.string()',
                number: 'z.number()',
                boolean: 'z.boolean()',
                unknown: 'z.unknown()',
                never: 'z.never()',
            }[type.name];
            return applyFacets(base, type, encodeFacets);
        case 'null':
            return 'z.null()';
        case 'ref':
            base = schemas.has(type.name)
                ? schemaConstName(type.name)
                : externalRef(type.name);
            return applyFacets(base, type, encodeFacets);
        case 'literal':
            return `z.literal(${lit(type.value)})`;
        case 'array':
            base = `z.array(${printType(type.of, schemas, encodeFacets)})`;
            return applyFacets(base, type, encodeFacets);
        case 'union': {
            const parts = type.types.map(t =>
                printType(t, schemas, encodeFacets),
            );
            return parts.length === 1
                ? parts[0]
                : `z.union([${parts.join(', ')}])`;
        }
        case 'intersection': {
            const parts = type.types.map(t =>
                printType(t, schemas, encodeFacets),
            );
            return parts.reduce((acc, part) => `${acc}.and(${part})`);
        }
        case 'object':
            return printObject(type.members, type.index, schemas, encodeFacets);
    }
};
const printObject = (
    members: TsMember[],
    index: TsType | undefined,
    schemas: Set<string>,
    encodeFacets: boolean,
): string => {
    const lines = members.map(m => {
        let value = printType(m.type, schemas, encodeFacets);
        if (m.optional) value += '.optional()';
        return `    ${propKey(m.name)}: ${value},`;
    });
    let expr = lines.length
        ? `z.object({\n${lines.join('\n')}\n})`
        : 'z.object({})';
    if (index) expr += `.catchall(${printType(index, schemas, encodeFacets)})`;
    return expr;
};

const printDeclBody = (
    decl: TsDecl,
    schemas: Set<string>,
    encodeFacets: boolean,
): string => {
    if (decl.k === 'alias') return printType(decl.type, schemas, encodeFacets);

    const own = printObject(decl.members, decl.index, schemas, encodeFacets);
    if (!decl.extends.length) return own;
    if (!decl.members.length && !decl.index)
        return decl.extends
            .map(schemaConstName)
            .reduce((a, b) => `${a}.and(${b})`);
    // Prefer .and so bases that are aliases / lazy schemas still work.
    return [...decl.extends.map(schemaConstName), own].reduce(
        (a, b) => `${a}.and(${b})`,
    );
};
/** Print declarations as a Zod schema source file. */
export const printZodDeclarations = (
    decls: TsDecl[],
    options: PrintZodOptions = {},
): string => {
    const encodeFacets = options.encodeFacets ?? false;
    const schemas = knownSchemas(decls);
    const lines: string[] = ["import { z } from 'zod';", ''];

    for (const decl of decls) {
        const name = schemaConstName(decl.name);
        const body = printDeclBody(decl, schemas, encodeFacets);
        lines.push(`export const ${name} = z.lazy(() => ${body});`);
        lines.push('');
    }

    const body = lines.join('\n').replace(/\n+$/, '\n');
    return options.header ? `${options.header}\n\n${body}` : body;
};
