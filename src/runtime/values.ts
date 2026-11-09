import { applyWhiteSpace, builtinCodec } from '../xsd/datatypes/codecs';
import { SimpleTypeDef, whiteSpaceOf } from '../xsd/model';

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** Name of the nearest built-in ancestor, which decides the lexical codec. */
const rootBuiltin = (type: SimpleTypeDef): string | undefined => {
    for (let cur: SimpleTypeDef | undefined = type; cur; cur = cur.base)
        if (cur.builtin) return cur.builtin.name;
    return undefined;
};

/** Does `text` look like a valid value of `type`? Used to pick a union member. */
const accepts = (type: SimpleTypeDef, text: string): boolean => {
    const value = applyWhiteSpace(text, whiteSpaceOf(type));
    if (type.facets.enumeration && !type.facets.enumeration.includes(value))
        return false;
    if (type.variety === 'union')
        return (type.memberTypes ?? []).some(m => accepts(m, text));
    if (type.variety === 'list') return true;
    switch (type.valueKind) {
        case 'number':
            return (
                NUMBER.test(value) ||
                ['INF', '-INF', '+INF', 'NaN'].includes(value)
            );
        case 'boolean':
            return ['true', 'false', '1', '0'].includes(value);
        default:
            return true;
    }
};

export interface ParseValueOptions {
    /** Return `Date` objects for `dateTime`, `dateTimeStamp` and `date` values. */
    dates?: boolean;
}

const DATE_TYPES = new Set(['dateTime', 'dateTimeStamp', 'date']);

/** Convert the lexical form of a simple type's value to a JavaScript value. */
export const parseSimple = (
    type: SimpleTypeDef,
    lexical: string,
    options: ParseValueOptions = {},
): unknown => {
    const text = applyWhiteSpace(lexical, whiteSpaceOf(type));

    if (type.variety === 'list') {
        const item = type.itemType!;
        return text === ''
            ? []
            : text.split(' ').map(part => parseSimple(item, part, options));
    }
    if (type.variety === 'union') {
        const members = type.memberTypes ?? [];
        const member = members.find(m => accepts(m, lexical));
        return member ? parseSimple(member, lexical, options) : text;
    }
    const builtin = rootBuiltin(type);
    if (options.dates && builtin && DATE_TYPES.has(builtin)) {
        const date = new Date(text);
        return Number.isNaN(date.getTime()) ? text : date;
    }
    return builtin ? builtinCodec(builtin).parse(text) : text;
};

const matchesKind = (type: SimpleTypeDef, value: unknown): boolean => {
    if (type.variety !== 'atomic') return false;
    switch (type.valueKind) {
        case 'number':
            return typeof value === 'number' || typeof value === 'bigint';
        case 'boolean':
            return typeof value === 'boolean';
        case 'date':
            return value instanceof Date;
        case 'binary-hex':
        case 'binary-base64':
            return value instanceof Uint8Array;
        default:
            return typeof value === 'string';
    }
};

/** Convert a JavaScript value to the lexical form of a simple type. */
export const formatSimple = (type: SimpleTypeDef, value: unknown): string => {
    if (value === null || value === undefined) return '';

    if (type.variety === 'list') {
        if (typeof value === 'string') return value;
        const item = type.itemType!;
        return (Array.isArray(value) ? value : [value])
            .map(v => formatSimple(item, v))
            .join(' ');
    }
    if (type.variety === 'union') {
        const member =
            (type.memberTypes ?? []).find(m => matchesKind(m, value)) ??
            (type.memberTypes ?? [])[0];
        return member ? formatSimple(member, value) : String(value);
    }
    const builtin = rootBuiltin(type);
    return builtin ? builtinCodec(builtin).format(value) : String(value);
};

/** Loose coercion for schema-less parsing: JSON numbers and booleans. */
export const coerceLoose = (text: string): string | number | boolean => {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(text))
        return Number(text);
    return text;
};
