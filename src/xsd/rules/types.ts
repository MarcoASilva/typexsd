import { FacetName } from '../datatypes/builtins';
import {
    RawAttribute,
    RawAttributeGroup,
    RawComplexDerivation,
    RawComplexType,
    RawFacet,
    RawList,
    RawOpenContent,
    RawParticle,
    RawShorthandContent,
    RawSimpleDerivation,
    RawSimpleRestriction,
    RawSimpleType,
    RawUnion,
    RawWildcard,
} from './raw';
import {
    Constraint,
    Kids,
    Slot,
    bool,
    custom,
    defineRule,
    derivationSet,
    globalOnly,
    ncName,
    oneOf,
    one,
    opt,
    qname,
    qnameList,
    star,
    str,
    token,
} from './engine';

const MODEL_GROUPS = ['group', 'all', 'choice', 'sequence'];
const ATTRIBUTE_USES = ['attribute', 'attributeGroup'];

export const FACET_ELEMENTS: FacetName[] = [
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

const nameRequiredWhenGlobal: Constraint = custom(
    'name-required',
    ({ present, global }) =>
        global && !present.has('name')
            ? '"name" is required on top-level declarations'
            : undefined,
);

const attributeContent = (kids: Kids) => ({
    attributes: kids.all
        .filter(k => ATTRIBUTE_USES.includes(k.name))
        .map(k => k.value as RawAttribute | RawAttributeGroup),
    anyAttribute: kids.first<RawWildcard>('anyAttribute'),
});

// -----------------------------------------------------------------------------
// simple types
// -----------------------------------------------------------------------------

defineRule<RawSimpleType>({
    name: 'simpleType',
    attributes: {
        id: token(),
        name: ncName(),
        final: derivationSet(['extension', 'restriction', 'list', 'union'], {
            default: [],
        }),
    },
    children: [opt('annotation'), one('restriction', 'list', 'union')],
    constraints: [nameRequiredWhenGlobal, globalOnly('name', 'final')],
    build: ({ a, kids }): RawSimpleType =>
        ({
            kind: 'simpleType',
            name: a.name,
            final: a.final ?? [],
            derivation: kids.first<RawSimpleRestriction | RawList | RawUnion>(
                'restriction',
                'list',
                'union',
            )!,
        } as RawSimpleType),
});

defineRule<RawList>({
    name: 'list',
    attributes: { id: token(), itemType: qname() },
    children: [opt('annotation'), opt('simpleType')],
    constraints: [
        custom('list-item-type', ({ present, kids }) => {
            const inline = kids.of('simpleType').length;
            if (present.has('itemType') && inline)
                return '"itemType" cannot be combined with an inline <simpleType>';
            if (!present.has('itemType') && !inline)
                return 'either "itemType" or an inline <simpleType> is required';
            return undefined;
        }),
    ],
    build: ({ a, kids }): RawList =>
        ({
            kind: 'list',
            itemType: a.itemType,
            inline: kids.first<RawSimpleType>('simpleType'),
        } as RawList),
});

defineRule<RawUnion>({
    name: 'union',
    attributes: { id: token(), memberTypes: qnameList() },
    children: [opt('annotation'), star('simpleType')],
    constraints: [
        custom('union-members', ({ a, kids }) =>
            (a.memberTypes?.length ?? 0) + kids.of('simpleType').length === 0
                ? 'a union needs "memberTypes" or at least one inline <simpleType>'
                : undefined,
        ),
    ],
    build: ({ a, kids }): RawUnion =>
        ({
            kind: 'union',
            memberTypes: a.memberTypes ?? [],
            inline: kids.of<RawSimpleType>('simpleType'),
        } as RawUnion),
});

// -- facets -------------------------------------------------------------------

const NON_NEGATIVE_FACETS: FacetName[] = [
    'length',
    'minLength',
    'maxLength',
    'fractionDigits',
];

for (const facet of FACET_ELEMENTS) {
    defineRule<RawFacet>({
        name: facet,
        attributes:
            facet === 'assertion'
                ? { id: token(), test: str() }
                : {
                      id: token(),
                      value: str({ required: true }),
                      fixed: bool({ default: false }),
                  },
        children: [opt('annotation')],
        constraints: [
            custom('facet-value', ({ a, present }) => {
                if (facet === 'assertion' || !present.has('value'))
                    return undefined;
                const value = String(a.value).trim();
                if (
                    NON_NEGATIVE_FACETS.includes(facet) &&
                    !/^\+?\d+$/.test(value)
                )
                    return `"${value}" is not a non-negative integer`;
                if (facet === 'totalDigits' && !/^\+?[1-9]\d*$/.test(value))
                    return `"${value}" is not a positive integer`;
                if (
                    facet === 'whiteSpace' &&
                    !['preserve', 'replace', 'collapse'].includes(value)
                )
                    return `"${value}" is not one of "preserve", "replace", "collapse"`;
                if (
                    facet === 'explicitTimezone' &&
                    !['required', 'prohibited', 'optional'].includes(value)
                )
                    return `"${value}" is not one of "required", "prohibited", "optional"`;
                return undefined;
            }),
        ],
        build: ({ a }): RawFacet =>
            ({
                name: facet,
                // `whiteSpace`/numeric facets are trimmed, `pattern`/`enumeration` are not
                value:
                    facet === 'assertion'
                        ? ''
                        : facet === 'pattern' || facet === 'enumeration'
                        ? String(a.value)
                        : String(a.value).trim(),
                fixed: a.fixed ?? false,
                test: a.test,
            } as RawFacet),
    });
}

// -- restriction / extension ----------------------------------------------------

const restrictionChildren = (parent: string): Slot[] => {
    switch (parent) {
        case 'simpleType':
            return [
                opt('annotation'),
                opt('simpleType'),
                star(...FACET_ELEMENTS),
            ];
        case 'simpleContent':
            return [
                opt('annotation'),
                opt('simpleType'),
                star(...FACET_ELEMENTS),
                star(...ATTRIBUTE_USES),
                opt('anyAttribute'),
                star('assert'),
            ];
        default:
            return [
                opt('annotation'),
                opt('openContent'),
                opt(...MODEL_GROUPS),
                star(...ATTRIBUTE_USES),
                opt('anyAttribute'),
                star('assert'),
            ];
    }
};

defineRule<any>({
    name: 'restriction',
    attributes: { id: token(), base: qname() },
    children: restrictionChildren,
    constraints: [
        custom('restriction-base', ({ present, kids, parent }) => {
            if (parent === 'simpleType') {
                const inline = kids.of('simpleType').length;
                if (present.has('base') && inline)
                    return '"base" cannot be combined with an inline <simpleType>';
                if (!present.has('base') && !inline)
                    return 'either "base" or an inline <simpleType> is required';
                return undefined;
            }
            return present.has('base') ? undefined : '"base" is required';
        }),
    ],
    build: ({ a, kids, parent }) => {
        const facets = kids.of<RawFacet>(...FACET_ELEMENTS);
        const inline = kids.first<RawSimpleType>('simpleType');
        if (parent === 'simpleType') {
            const result: RawSimpleRestriction = {
                kind: 'restriction',
                base: a.base,
                inline,
                facets,
            } as RawSimpleRestriction;
            return result;
        }
        if (parent === 'simpleContent') {
            const result: RawSimpleDerivation = {
                form: 'simple',
                derivation: 'restriction',
                base: a.base,
                inlineSimple: inline,
                facets,
                ...attributeContent(kids),
            };
            return result;
        }
        const result: RawComplexDerivation = {
            form: 'complex',
            derivation: 'restriction',
            base: a.base,
            particle: kids.first<RawParticle>(...MODEL_GROUPS),
            openContent: kids.first<RawOpenContent>('openContent'),
            ...attributeContent(kids),
        };
        return result;
    },
});

defineRule<any>({
    name: 'extension',
    attributes: { id: token(), base: qname({ required: true }) },
    children: parent =>
        parent === 'simpleContent'
            ? [
                  opt('annotation'),
                  star(...ATTRIBUTE_USES),
                  opt('anyAttribute'),
                  star('assert'),
              ]
            : [
                  opt('annotation'),
                  opt('openContent'),
                  opt(...MODEL_GROUPS),
                  star(...ATTRIBUTE_USES),
                  opt('anyAttribute'),
                  star('assert'),
              ],
    build: ({ a, kids, parent }) => {
        if (parent === 'simpleContent') {
            const result: RawSimpleDerivation = {
                form: 'simple',
                derivation: 'extension',
                base: a.base,
                facets: [],
                ...attributeContent(kids),
            };
            return result;
        }
        const result: RawComplexDerivation = {
            form: 'complex',
            derivation: 'extension',
            base: a.base,
            particle: kids.first<RawParticle>(...MODEL_GROUPS),
            openContent: kids.first<RawOpenContent>('openContent'),
            ...attributeContent(kids),
        };
        return result;
    },
});

// -----------------------------------------------------------------------------
// complex types
// -----------------------------------------------------------------------------

defineRule<any>({
    name: 'simpleContent',
    attributes: { id: token() },
    children: [opt('annotation'), one('restriction', 'extension')],
    build: ({ kids }) =>
        kids.first<RawSimpleDerivation>('restriction', 'extension'),
});

defineRule<any>({
    name: 'complexContent',
    attributes: { id: token(), mixed: bool() },
    children: [opt('annotation'), one('restriction', 'extension')],
    build: ({ a, kids }) => {
        const derivation = kids.first<RawComplexDerivation>(
            'restriction',
            'extension',
        )!;
        return { ...derivation, mixed: a.mixed };
    },
});

defineRule<RawComplexType>({
    name: 'complexType',
    attributes: {
        id: token(),
        name: ncName(),
        mixed: bool(),
        abstract: bool({ default: false }),
        block: derivationSet(['extension', 'restriction'], { default: [] }),
        final: derivationSet(['extension', 'restriction'], { default: [] }),
        defaultAttributesApply: bool(),
    },
    children: [
        opt('annotation'),
        opt('simpleContent', 'complexContent'),
        opt('openContent'),
        opt(...MODEL_GROUPS),
        star(...ATTRIBUTE_USES),
        opt('anyAttribute'),
        star('assert'),
    ],
    constraints: [
        nameRequiredWhenGlobal,
        globalOnly('name', 'abstract', 'block', 'final'),
        custom('complextype-content-form', ({ kids }) => {
            const derived = kids.of('simpleContent', 'complexContent').length;
            const direct = kids.of(
                ...MODEL_GROUPS,
                ...ATTRIBUTE_USES,
                'anyAttribute',
                'openContent',
            ).length;
            if (derived && direct)
                return '<simpleContent>/<complexContent> cannot be combined with direct particles or attributes';
            return undefined;
        }),
        {
            ...custom('complextype-simplecontent-mixed', ({ kids, present }) =>
                present.has('mixed') && kids.of('simpleContent').length
                    ? '"mixed" is not allowed together with <simpleContent> (ignored)'
                    : undefined,
            ),
            severity: 'warning',
        },
    ],
    build: ({ a, kids }): RawComplexType => {
        const derived = kids.first<RawSimpleDerivation | RawComplexDerivation>(
            'simpleContent',
            'complexContent',
        );
        let mixed: boolean | undefined = a.mixed;
        let content: RawComplexType['content'];
        if (derived) {
            content = derived;
            if (derived.form === 'complex' && derived.mixed !== undefined)
                mixed = derived.mixed;
        } else {
            const shorthand: RawShorthandContent = {
                form: 'shorthand',
                particle: kids.first<RawParticle>(...MODEL_GROUPS),
                ...attributeContent(kids),
            };
            content = shorthand;
        }
        return {
            kind: 'complexType',
            name: a.name,
            abstract: a.abstract,
            mixed,
            block: a.block ?? [],
            final: a.final ?? [],
            content,
            openContent: kids.first<RawOpenContent>('openContent'),
            assertions: kids.of<string>('assert'),
        } as RawComplexType;
    },
});

defineRule<RawOpenContent>({
    name: 'openContent',
    attributes: {
        id: token(),
        mode: oneOf(['interleave', 'suffix', 'none'] as const, {
            default: 'interleave',
        }),
    },
    children: [opt('annotation'), opt('any')],
    build: ({ a, kids }) =>
        ({
            kind: 'openContent',
            mode: a.mode,
            wildcard: kids.first<RawWildcard>('any'),
        } as RawOpenContent),
});

defineRule<any>({
    name: 'defaultOpenContent',
    attributes: {
        id: token(),
        appliesToEmpty: bool({ default: false }),
        mode: oneOf(['interleave', 'suffix'] as const, {
            default: 'interleave',
        }),
    },
    children: [opt('annotation'), one('any')],
    build: ({ a, kids }) => ({
        kind: 'openContent',
        mode: a.mode,
        wildcard: kids.first<RawWildcard>('any'),
        appliesToEmpty: a.appliesToEmpty,
    }),
});

defineRule<string>({
    name: 'assert',
    attributes: {
        id: token(),
        test: str({ required: true }),
        xpathDefaultNamespace: token(),
    },
    children: [opt('annotation')],
    build: ({ a }) => String(a.test),
});
