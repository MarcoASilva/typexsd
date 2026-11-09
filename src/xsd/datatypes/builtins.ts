/**
 * Registry of the XML Schema built-in datatypes (XSD 1.0 part 2 and the 1.1
 * additions): hierarchy, whitespace handling, applicable facets and the
 * restrictions that built-in derivations impose (e.g. `byte` is -128..127).
 */

export type FacetName =
    | 'length'
    | 'minLength'
    | 'maxLength'
    | 'pattern'
    | 'enumeration'
    | 'whiteSpace'
    | 'maxInclusive'
    | 'maxExclusive'
    | 'minExclusive'
    | 'minInclusive'
    | 'totalDigits'
    | 'fractionDigits'
    | 'explicitTimezone'
    | 'assertion';

export const ALL_FACETS: FacetName[] = [
    'length',
    'minLength',
    'maxLength',
    'pattern',
    'enumeration',
    'whiteSpace',
    'maxInclusive',
    'maxExclusive',
    'minExclusive',
    'minInclusive',
    'totalDigits',
    'fractionDigits',
    'explicitTimezone',
    'assertion',
];

export type WhiteSpace = 'preserve' | 'replace' | 'collapse';

export type Variety = 'atomic' | 'list' | 'union';

/** How a value of a (derived) built-in type is represented in JavaScript. */
export type ValueKind =
    | 'string'
    | 'boolean'
    | 'number'
    | 'binary-hex'
    | 'binary-base64'
    | 'date'
    | 'unknown';

export interface BuiltinTypeInfo {
    name: string;
    /** Local name of the base type, `null` only for `anySimpleType`'s base (`anyType`). */
    base: string;
    /** Local name of the primitive ancestor (itself for primitives). */
    primitive?: string;
    variety: Variety;
    itemType?: string;
    whiteSpace: WhiteSpace;
    /** Facets that can be applied when restricting this type. */
    facets: FacetName[];
    /** Facet values fixed by the built-in derivation itself. */
    own: Partial<Record<FacetName, string>>;
    valueKind: ValueKind;
    xsd11?: boolean;
}

const LENGTH_FACETS: FacetName[] = [
    'length',
    'minLength',
    'maxLength',
    'pattern',
    'enumeration',
    'whiteSpace',
    'assertion',
];
const ORDERED: FacetName[] = [
    'pattern',
    'enumeration',
    'whiteSpace',
    'maxInclusive',
    'maxExclusive',
    'minInclusive',
    'minExclusive',
    'assertion',
];
const TEMPORAL: FacetName[] = [...ORDERED, 'explicitTimezone'];
const NUMERIC: FacetName[] = [...ORDERED, 'totalDigits', 'fractionDigits'];

export const BUILTINS = new Map<string, BuiltinTypeInfo>();

const add = (info: BuiltinTypeInfo): void => {
    BUILTINS.set(info.name, info);
};

const primitive = (
    name: string,
    valueKind: ValueKind,
    facets: FacetName[],
    whiteSpace: WhiteSpace = 'collapse',
): void =>
    add({
        name,
        base: 'anyAtomicType',
        primitive: name,
        variety: 'atomic',
        whiteSpace,
        facets,
        own: { whiteSpace },
        valueKind,
    });

const derived = (
    name: string,
    base: string,
    own: Partial<Record<FacetName, string>> = {},
    extra: Partial<BuiltinTypeInfo> = {},
): void => {
    const parent = BUILTINS.get(base)!;
    add({
        name,
        base,
        primitive: parent.primitive,
        variety: parent.variety,
        itemType: parent.itemType,
        whiteSpace: (own.whiteSpace as WhiteSpace) ?? parent.whiteSpace,
        facets: parent.facets,
        own,
        valueKind: parent.valueKind,
        ...extra,
    });
};

const list = (name: string, itemType: string): void =>
    add({
        name,
        base: 'anySimpleType',
        variety: 'list',
        itemType,
        whiteSpace: 'collapse',
        facets: LENGTH_FACETS,
        own: { whiteSpace: 'collapse', minLength: '1' },
        valueKind: BUILTINS.get(itemType)!.valueKind,
    });

// -- ur-types -----------------------------------------------------------------
add({
    name: 'anySimpleType',
    base: 'anyType',
    variety: 'atomic',
    whiteSpace: 'preserve',
    facets: [],
    own: {},
    valueKind: 'string',
});
add({
    name: 'anyAtomicType',
    base: 'anySimpleType',
    variety: 'atomic',
    whiteSpace: 'preserve',
    facets: [],
    own: {},
    valueKind: 'string',
    xsd11: true,
});

// -- primitives ---------------------------------------------------------------
primitive('string', 'string', LENGTH_FACETS, 'preserve');
primitive('boolean', 'boolean', ['pattern', 'whiteSpace', 'assertion']);
primitive('decimal', 'number', NUMERIC);
primitive('float', 'number', ORDERED);
primitive('double', 'number', ORDERED);
primitive('duration', 'string', ORDERED);
primitive('dateTime', 'date', TEMPORAL);
primitive('time', 'date', TEMPORAL);
primitive('date', 'date', TEMPORAL);
primitive('gYearMonth', 'string', TEMPORAL);
primitive('gYear', 'string', TEMPORAL);
primitive('gMonthDay', 'string', TEMPORAL);
primitive('gDay', 'string', TEMPORAL);
primitive('gMonth', 'string', TEMPORAL);
primitive('hexBinary', 'binary-hex', LENGTH_FACETS);
primitive('base64Binary', 'binary-base64', LENGTH_FACETS);
primitive('anyURI', 'string', LENGTH_FACETS);
primitive('QName', 'string', LENGTH_FACETS);
primitive('NOTATION', 'string', LENGTH_FACETS);

// -- string family ------------------------------------------------------------
derived('normalizedString', 'string', { whiteSpace: 'replace' });
derived('token', 'normalizedString', { whiteSpace: 'collapse' });
derived('language', 'token');
derived('NMTOKEN', 'token');
derived('Name', 'token');
derived('NCName', 'Name');
derived('ID', 'NCName');
derived('IDREF', 'NCName');
derived('ENTITY', 'NCName');
list('NMTOKENS', 'NMTOKEN');
list('IDREFS', 'IDREF');
list('ENTITIES', 'ENTITY');

// -- numeric family -----------------------------------------------------------
derived('integer', 'decimal', { fractionDigits: '0' });
derived('nonPositiveInteger', 'integer', { maxInclusive: '0' });
derived('negativeInteger', 'nonPositiveInteger', { maxInclusive: '-1' });
derived('long', 'integer', {
    minInclusive: '-9223372036854775808',
    maxInclusive: '9223372036854775807',
});
derived('int', 'long', {
    minInclusive: '-2147483648',
    maxInclusive: '2147483647',
});
derived('short', 'int', { minInclusive: '-32768', maxInclusive: '32767' });
derived('byte', 'short', { minInclusive: '-128', maxInclusive: '127' });
derived('nonNegativeInteger', 'integer', { minInclusive: '0' });
derived('unsignedLong', 'nonNegativeInteger', {
    maxInclusive: '18446744073709551615',
});
derived('unsignedInt', 'unsignedLong', { maxInclusive: '4294967295' });
derived('unsignedShort', 'unsignedInt', { maxInclusive: '65535' });
derived('unsignedByte', 'unsignedShort', { maxInclusive: '255' });
derived('positiveInteger', 'nonNegativeInteger', { minInclusive: '1' });

// -- XSD 1.1 additions --------------------------------------------------------
derived(
    'dateTimeStamp',
    'dateTime',
    { explicitTimezone: 'required' },
    { xsd11: true },
);
derived(
    'dayTimeDuration',
    'duration',
    { pattern: '[^YM]*(T.*)?' },
    { xsd11: true },
);
derived(
    'yearMonthDuration',
    'duration',
    { pattern: '[^DT]*' },
    { xsd11: true },
);

export const isBuiltinTypeName = (local: string): boolean =>
    BUILTINS.has(local);

export const builtinInfo = (local: string): BuiltinTypeInfo | undefined =>
    BUILTINS.get(local);

/** Numeric built-ins whose values are integers. */
export const isIntegerBuiltin = (local: string): boolean => {
    for (
        let cur: BuiltinTypeInfo | undefined = BUILTINS.get(local);
        cur;
        cur = BUILTINS.get(cur.base)
    ) {
        if (cur.name === 'integer') return true;
    }
    return false;
};
