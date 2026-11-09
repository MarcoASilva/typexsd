import {
    FormChoice,
    RawAttribute,
    RawAttributeGroup,
    RawComplexType,
    RawElement,
    RawGlobalComponent,
    RawGroup,
    RawImport,
    RawInclude,
    RawNotation,
    RawOpenContent,
    RawOverride,
    RawRedefine,
    RawSchema,
    RawSimpleType,
} from './raw';
import {
    custom,
    defineRule,
    derivationSet,
    oneOf,
    opt,
    ncName,
    star,
    token,
    uri,
} from './engine';

const GLOBAL_COMPONENTS = [
    'simpleType',
    'complexType',
    'group',
    'attributeGroup',
    'element',
    'attribute',
    'notation',
];

const FORM = ['qualified', 'unqualified'] as const;

defineRule<RawSchema>({
    name: 'schema',
    attributes: {
        id: token(),
        targetNamespace: uri(),
        version: token(),
        elementFormDefault: oneOf(FORM, { default: 'unqualified' }),
        attributeFormDefault: oneOf(FORM, { default: 'unqualified' }),
        blockDefault: derivationSet(
            ['extension', 'restriction', 'substitution'],
            {
                default: [],
            },
        ),
        finalDefault: derivationSet(
            ['extension', 'restriction', 'list', 'union'],
            { default: [] },
        ),
        defaultAttributes: token(),
        xpathDefaultNamespace: token(),
    },
    children: [
        star('include', 'import', 'redefine', 'override', 'annotation'),
        star('defaultOpenContent', 'annotation'),
        star(...GLOBAL_COMPONENTS, 'annotation'),
    ],
    prepare: ({ a, ctx }) => {
        ctx.targetNamespace = a.targetNamespace ?? ctx.chameleonNs ?? '';
    },
    build: ({ a, kids, ctx }): RawSchema => {
        const defaultOpen = kids.first<RawOpenContent>('defaultOpenContent');
        return {
            kind: 'schema',
            path: '/schema',
            file: ctx.file,
            targetNamespace: ctx.targetNamespace,
            hasTargetNamespace: a.targetNamespace !== undefined,
            elementFormDefault: a.elementFormDefault as FormChoice,
            attributeFormDefault: a.attributeFormDefault as FormChoice,
            blockDefault: a.blockDefault,
            finalDefault: a.finalDefault,
            version: a.version,
            defaultOpenContent: defaultOpen
                ? {
                      ...defaultOpen,
                      appliesToEmpty: Boolean(
                          (defaultOpen as any).appliesToEmpty,
                      ),
                  }
                : undefined,
            includes: kids.of<RawInclude>('include'),
            imports: kids.of<RawImport>('import'),
            redefines: kids.of<RawRedefine>('redefine'),
            overrides: kids.of<RawOverride>('override'),
            simpleTypes: kids.of<RawSimpleType>('simpleType'),
            complexTypes: kids.of<RawComplexType>('complexType'),
            groups: kids.of<RawGroup>('group'),
            attributeGroups: kids.of<RawAttributeGroup>('attributeGroup'),
            elements: kids.of<RawElement>('element'),
            attributes: kids.of<RawAttribute>('attribute'),
            notations: kids.of<RawNotation>('notation'),
        };
    },
});

defineRule<RawInclude>({
    name: 'include',
    attributes: { id: token(), schemaLocation: uri({ required: true }) },
    children: [opt('annotation')],
    build: ({ a }) =>
        ({
            kind: 'include',
            schemaLocation: a.schemaLocation,
        } as RawInclude),
});

defineRule<RawImport>({
    name: 'import',
    attributes: { id: token(), namespace: uri(), schemaLocation: uri() },
    children: [opt('annotation')],
    build: ({ a }) =>
        ({
            kind: 'import',
            namespace: a.namespace,
            schemaLocation: a.schemaLocation,
        } as RawImport),
});

defineRule<RawRedefine>({
    name: 'redefine',
    attributes: { id: token(), schemaLocation: uri({ required: true }) },
    children: [
        star(
            'annotation',
            'simpleType',
            'complexType',
            'group',
            'attributeGroup',
        ),
    ],
    build: ({ a, kids }) =>
        ({
            kind: 'redefine',
            schemaLocation: a.schemaLocation,
            components: kids.all
                .filter(k => k.name !== 'annotation')
                .map(k => k.value as RawGlobalComponent),
        } as RawRedefine),
});

defineRule<RawOverride>({
    name: 'override',
    attributes: { id: token(), schemaLocation: uri({ required: true }) },
    children: [star('annotation', ...GLOBAL_COMPONENTS)],
    build: ({ a, kids }) =>
        ({
            kind: 'override',
            schemaLocation: a.schemaLocation,
            components: kids.all
                .filter(k => k.name !== 'annotation')
                .map(k => k.value as RawGlobalComponent),
        } as RawOverride),
});

defineRule<RawNotation>({
    name: 'notation',
    attributes: {
        id: token(),
        name: ncName({ required: true }),
        public: token(),
        system: uri(),
    },
    children: [opt('annotation')],
    constraints: [
        custom('notation-identifier', ({ present }) =>
            present.has('public') || present.has('system')
                ? undefined
                : 'either "public" or "system" is required',
        ),
    ],
    build: ({ a }) =>
        ({
            kind: 'notation',
            name: a.name,
            public: a.public,
            system: a.system,
        } as RawNotation),
});
