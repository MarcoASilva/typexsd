import {
    RawAlternative,
    RawAttribute,
    RawAttributeGroup,
    RawElement,
    RawGroup,
    RawIdentityConstraint,
    RawModelGroup,
    RawParticle,
    RawSimpleType,
    RawType,
    RawWildcard,
} from './raw';
import {
    atMostOne,
    bool,
    custom,
    defineRule,
    derivationSet,
    forbidWith,
    globalOnly,
    localOnly,
    maxOccurs,
    ncName,
    nonNegInt,
    occursConstraint,
    occursOf,
    oneOf,
    one,
    opt,
    plus,
    qname,
    qnameList,
    star,
    str,
    token,
    uri,
} from './engine';

const FORM = ['qualified', 'unqualified'] as const;
const PARTICLES = ['element', 'group', 'choice', 'sequence', 'any'];

// -----------------------------------------------------------------------------
// element
// -----------------------------------------------------------------------------

defineRule<RawElement>({
    name: 'element',
    attributes: {
        id: token(),
        name: ncName(),
        ref: qname(),
        type: qname(),
        minOccurs: nonNegInt({ default: 1 }),
        maxOccurs: maxOccurs({ default: 1 }),
        nillable: bool({ default: false }),
        default: str(),
        fixed: str(),
        abstract: bool({ default: false }),
        substitutionGroup: qnameList(),
        form: oneOf(FORM),
        block: derivationSet(['extension', 'restriction', 'substitution'], {
            default: [],
        }),
        final: derivationSet(['extension', 'restriction'], { default: [] }),
        targetNamespace: uri(),
    },
    children: [
        opt('annotation'),
        opt('simpleType', 'complexType'),
        star('alternative'),
        star('unique', 'key', 'keyref'),
    ],
    constraints: [
        custom('element-name-or-ref', ({ present }) => {
            const hasName = present.has('name');
            const hasRef = present.has('ref');
            if (hasName && hasRef)
                return '"name" and "ref" cannot be used together';
            if (!hasName && !hasRef)
                return 'either "name" or "ref" is required';
            return undefined;
        }),
        forbidWith(
            'ref',
            [
                'type',
                'nillable',
                'default',
                'fixed',
                'block',
                'final',
                'abstract',
                'substitutionGroup',
                'form',
            ],
            ['simpleType', 'complexType', 'unique', 'key', 'keyref'],
        ),
        atMostOne('default', 'fixed'),
        custom('element-type-and-inline', ({ present, kids }) =>
            present.has('type') && kids.of('simpleType', 'complexType').length
                ? '"type" cannot be combined with an inline type definition'
                : undefined,
        ),
        globalOnly('abstract', 'substitutionGroup', 'final'),
        localOnly('ref', 'minOccurs', 'maxOccurs', 'form'),
        occursConstraint,
    ],
    build: ({ a, kids, global }): RawElement =>
        ({
            kind: 'element',
            name: a.name,
            ref: a.ref,
            type: a.type,
            inlineType: kids.first<RawType>('simpleType', 'complexType'),
            occurs: occursOf(a),
            nillable: a.nillable,
            default: a.default,
            fixed: a.fixed,
            abstract: a.abstract,
            substitutionGroup: a.substitutionGroup ?? [],
            form: a.form,
            block: a.block,
            final: a.final,
            identity: kids.of<RawIdentityConstraint>('unique', 'key', 'keyref'),
            alternatives: kids.of<RawAlternative>('alternative'),
            global,
            targetNamespace: a.targetNamespace,
        } as RawElement),
});

defineRule<RawAlternative>({
    name: 'alternative',
    attributes: {
        id: token(),
        test: str(),
        type: qname(),
        xpathDefaultNamespace: token(),
    },
    children: [opt('annotation'), opt('simpleType', 'complexType')],
    build: ({ a, kids }) =>
        ({
            test: a.test,
            type: a.type,
            inlineType: kids.first<RawType>('simpleType', 'complexType'),
        } as RawAlternative),
});

// -----------------------------------------------------------------------------
// identity constraints
// -----------------------------------------------------------------------------

const identityRule = (kind: 'unique' | 'key' | 'keyref') =>
    defineRule<RawIdentityConstraint>({
        name: kind,
        attributes: {
            id: token(),
            name: ncName({ required: true }),
            ...(kind === 'keyref' ? { refer: qname({ required: true }) } : {}),
        },
        children: [opt('annotation'), one('selector'), plus('field')],
        build: ({ a, kids }) =>
            ({
                kind,
                name: a.name,
                refer: a.refer,
                selector:
                    kids.first<{ xpath: string }>('selector')?.xpath ?? '',
                fields: kids.of<{ xpath: string }>('field').map(f => f.xpath),
            } as RawIdentityConstraint),
    });

identityRule('unique');
identityRule('key');
identityRule('keyref');

for (const name of ['selector', 'field']) {
    defineRule<{ xpath: string }>({
        name,
        attributes: {
            id: token(),
            xpath: str({ required: true }),
            xpathDefaultNamespace: token(),
        },
        children: [opt('annotation')],
        build: ({ a }) => ({ xpath: String(a.xpath).trim() }),
    });
}

// -----------------------------------------------------------------------------
// attribute / attributeGroup
// -----------------------------------------------------------------------------

defineRule<RawAttribute>({
    name: 'attribute',
    attributes: {
        id: token(),
        name: ncName(),
        ref: qname(),
        type: qname(),
        use: oneOf(['optional', 'required', 'prohibited'] as const, {
            default: 'optional',
        }),
        default: str(),
        fixed: str(),
        form: oneOf(FORM),
        inheritable: bool({ default: false }),
        targetNamespace: uri(),
    },
    children: [opt('annotation'), opt('simpleType')],
    constraints: [
        custom('attribute-name-or-ref', ({ present }) => {
            const hasName = present.has('name');
            const hasRef = present.has('ref');
            if (hasName && hasRef)
                return '"name" and "ref" cannot be used together';
            if (!hasName && !hasRef)
                return 'either "name" or "ref" is required';
            return undefined;
        }),
        forbidWith('ref', ['type', 'form'], ['simpleType']),
        atMostOne('default', 'fixed'),
        custom('attribute-type-and-inline', ({ present, kids }) =>
            present.has('type') && kids.of('simpleType').length
                ? '"type" cannot be combined with an inline <simpleType>'
                : undefined,
        ),
        custom('attribute-default-use', ({ present, a }) =>
            present.has('default') && present.has('use') && a.use !== 'optional'
                ? '"default" requires use="optional"'
                : undefined,
        ),
        localOnly('ref', 'use', 'form'),
    ],
    build: ({ a, kids, global }): RawAttribute =>
        ({
            kind: 'attribute',
            name: a.name,
            ref: a.ref,
            type: a.type,
            inlineType: kids.first<RawSimpleType>('simpleType'),
            use: a.use,
            default: a.default,
            fixed: a.fixed,
            form: a.form,
            inheritable: a.inheritable,
            global,
            targetNamespace: a.targetNamespace,
        } as RawAttribute),
});

defineRule<RawAttributeGroup>({
    name: 'attributeGroup',
    attributes: { id: token(), name: ncName(), ref: qname() },
    children: [
        opt('annotation'),
        star('attribute', 'attributeGroup'),
        opt('anyAttribute'),
    ],
    constraints: [
        custom('attributegroup-name-or-ref', ({ present, global }) => {
            if (global)
                return present.has('name')
                    ? undefined
                    : '"name" is required on top-level declarations';
            return present.has('ref')
                ? undefined
                : '"ref" is required for an attribute group reference';
        }),
        globalOnly('name'),
        localOnly('ref'),
        custom('attributegroup-ref-content', ({ present, kids }) =>
            present.has('ref') &&
            kids.of('attribute', 'attributeGroup', 'anyAttribute').length
                ? 'an attribute group reference cannot have content'
                : undefined,
        ),
    ],
    build: ({ a, kids }): RawAttributeGroup =>
        ({
            kind: 'attributeGroup',
            name: a.name,
            ref: a.ref,
            attributes: kids.all
                .filter(
                    k => k.name === 'attribute' || k.name === 'attributeGroup',
                )
                .map(k => k.value as RawAttribute | RawAttributeGroup),
            anyAttribute: kids.first<RawWildcard>('anyAttribute'),
        } as RawAttributeGroup),
});

// -----------------------------------------------------------------------------
// model groups, group definitions/references, wildcards
// -----------------------------------------------------------------------------

const modelGroupRule = (kind: 'sequence' | 'choice' | 'all') =>
    defineRule<RawModelGroup>({
        name: kind,
        attributes: {
            id: token(),
            minOccurs: nonNegInt({ default: 1 }),
            maxOccurs: maxOccurs({ default: 1 }),
        },
        children:
            kind === 'all'
                ? [opt('annotation'), star('element', 'any', 'group')]
                : [opt('annotation'), star(...PARTICLES)],
        constraints: [
            occursConstraint,
            ...(kind === 'all'
                ? [
                      custom('all-occurs', ({ a }) =>
                          a.maxOccurs > 1
                              ? '"maxOccurs" of <all> cannot be greater than 1'
                              : undefined,
                      ),
                      custom('all-particle-occurs', ({ kids }) => {
                          const bad = kids
                              .of<RawParticle>('element')
                              .filter(e => (e as RawElement).occurs.max > 1);
                          return bad.length
                              ? 'elements in <all> should not have maxOccurs greater than 1 (allowed in XSD 1.1 only)'
                              : undefined;
                      }),
                  ]
                : []),
        ],
        build: ({ a, kids }): RawModelGroup =>
            ({
                kind,
                occurs: occursOf(a),
                particles: kids.all
                    .filter(k => k.name !== 'annotation')
                    .map(k => k.value as RawParticle),
            } as RawModelGroup),
    });

modelGroupRule('sequence');
modelGroupRule('choice');
modelGroupRule('all');

defineRule<RawGroup>({
    name: 'group',
    attributes: {
        id: token(),
        name: ncName(),
        ref: qname(),
        minOccurs: nonNegInt({ default: 1 }),
        maxOccurs: maxOccurs({ default: 1 }),
    },
    children: [opt('annotation'), opt('all', 'choice', 'sequence')],
    constraints: [
        custom('group-name-or-ref', ({ present, global }) => {
            if (global)
                return present.has('name')
                    ? undefined
                    : '"name" is required on top-level declarations';
            return present.has('ref')
                ? undefined
                : '"ref" is required for a group reference';
        }),
        globalOnly('name'),
        localOnly('ref', 'minOccurs', 'maxOccurs'),
        custom('group-content', ({ global, kids }) => {
            const n = kids.of('all', 'choice', 'sequence').length;
            if (global && n !== 1)
                return 'a group definition needs exactly one of <all>, <choice> or <sequence>';
            if (!global && n > 0)
                return 'a group reference cannot contain a model group';
            return undefined;
        }),
        occursConstraint,
    ],
    build: ({ a, kids, global }): RawGroup =>
        ({
            kind: 'group',
            name: a.name,
            ref: a.ref,
            occurs: global ? { min: 1, max: 1 } : occursOf(a),
            model: kids.first<RawModelGroup>('all', 'choice', 'sequence'),
        } as RawGroup),
});

const wildcardRule = (kind: 'any' | 'anyAttribute') =>
    defineRule<RawWildcard>({
        name: kind,
        attributes: {
            id: token(),
            namespace: str(),
            notNamespace: str(),
            notQName: str(),
            processContents: oneOf(['strict', 'lax', 'skip'] as const, {
                default: 'strict',
            }),
            ...(kind === 'any'
                ? {
                      minOccurs: nonNegInt({ default: 1 }),
                      maxOccurs: maxOccurs({ default: 1 }),
                  }
                : {}),
        },
        children: [opt('annotation')],
        constraints: [atMostOne('namespace', 'notNamespace'), occursConstraint],
        build: ({ a, ctx }): RawWildcard =>
            ({
                kind,
                namespace: a.namespace ?? '##any',
                notNamespace: a.notNamespace,
                notQName: a.notQName,
                processContents: a.processContents,
                occurs: kind === 'any' ? occursOf(a) : { min: 0, max: 1 },
                targetNamespace: ctx.targetNamespace,
            } as RawWildcard),
    });

wildcardRule('any');
wildcardRule('anyAttribute');
