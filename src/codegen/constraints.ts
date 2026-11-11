import { SimpleTypeDef } from '../xsd/model';
import { TypeConstraints } from './ir';

const asNumber = (raw: string | undefined): number | undefined => {
    if (raw === undefined) return undefined;
    const n = Number(raw);
    return raw !== '' && Number.isFinite(n) ? n : undefined;
};

/** Effective facets of a simple type, as Zod-encodable constraints. */
export const constraintsOf = (type: SimpleTypeDef): TypeConstraints => {
    const f = type.facets;
    const c: TypeConstraints = {};
    if (f.length !== undefined) c.length = f.length;
    if (f.minLength !== undefined) c.minLength = f.minLength;
    if (f.maxLength !== undefined) c.maxLength = f.maxLength;
    if (f.patterns.length) c.patterns = f.patterns.map(step => [...step]);

    if (type.valueKind === 'number') {
        const minIn = asNumber(f.minInclusive);
        const maxIn = asNumber(f.maxInclusive);
        const minEx = asNumber(f.minExclusive);
        const maxEx = asNumber(f.maxExclusive);
        if (minIn !== undefined) c.minInclusive = minIn;
        if (maxIn !== undefined) c.maxInclusive = maxIn;
        if (minEx !== undefined) c.minExclusive = minEx;
        if (maxEx !== undefined) c.maxExclusive = maxEx;
    }

    return c;
};

/** Drop empty constraint bags so callers can skip `withConstraints`. */
export const nonEmptyConstraints = (
    c: TypeConstraints,
): TypeConstraints | undefined => {
    for (const value of Object.values(c)) {
        if (value === undefined) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        return c;
    }
    return undefined;
};
