import { DiagnosticBag } from '../diagnostics';
import { QName, XML_NS, XSD_NS, qkey, qname } from '../names';
import { BUILTINS, FacetName } from '../datatypes/builtins';
import { SchemaDocument, SchemaSet } from '../loader';
import {
    AttributeDecl,
    AttributeUse,
    CompiledSchema,
    ComplexTypeDef,
    ElementDecl,
    IdentityConstraint,
    ModelGroup,
    NamedAttributeGroup,
    NamedGroup,
    NamespaceConstraint,
    OpenContent,
    Particle,
    ResolvedFacets,
    SimpleTypeDef,
    TypeDef,
    Wildcard,
} from '../model';
import {
    DerivationMethod,
    RawAttribute,
    RawAttributeGroup,
    RawComplexType,
    RawElement,
    RawFacet,
    RawGlobalComponent,
    RawGroup,
    RawIdentityConstraint,
    RawModelGroup,
    RawNotation,
    RawOpenContent,
    RawParticle,
    RawSchema,
    RawSimpleType,
    RawType,
    RawWildcard,
} from '../rules/raw';

export interface CompileOptions {
    /** Throw an `XsdError` if any error diagnostic was produced. */
    strict?: boolean;
}

interface DocScope {
    doc: SchemaDocument;
    raw: RawSchema;
    tns: string;
}

type Kind =
    | 'element'
    | 'attribute'
    | 'type'
    | 'group'
    | 'attributeGroup'
    | 'notation';

interface Entry<R> {
    raw: R;
    scope: DocScope;
    name: QName;
}

type Located = { path?: string; file?: string };

const EMPTY_FACETS = (): ResolvedFacets => ({ patterns: [], assertions: [] });

const kindOf = (raw: RawGlobalComponent): Kind => {
    switch (raw.kind) {
        case 'simpleType':
        case 'complexType':
            return 'type';
        default:
            return raw.kind;
    }
};

const isTypeRaw = (raw: RawType): raw is RawComplexType =>
    raw.kind === 'complexType';

class Compiler {
    readonly diag: DiagnosticBag;
    private nextId = 1;

    private registry: Record<Kind, Map<string, Entry<any>>> = {
        element: new Map(),
        attribute: new Map(),
        type: new Map(),
        group: new Map(),
        attributeGroup: new Map(),
        notation: new Map(),
    };

    private builtinDefs = new Map<string, SimpleTypeDef>();
    private xmlAttributes = new Map<string, AttributeDecl>();
    readonly anySimpleType: SimpleTypeDef;
    readonly anyType: ComplexTypeDef;

    private typeShells = new Map<Entry<RawType>, TypeDef>();
    private elementShells = new Map<Entry<RawElement>, ElementDecl>();
    private attributeShells = new Map<Entry<RawAttribute>, AttributeDecl>();
    private typeSources = new Map<TypeDef, { raw: RawType; scope: DocScope }>();
    private elementSources = new Map<
        ElementDecl,
        { raw: RawElement; scope: DocScope }
    >();
    private attributeSources = new Map<
        AttributeDecl,
        { raw: RawAttribute; scope: DocScope }
    >();
    private state = new Map<object, 'resolving' | 'done'>();

    private groups = new Map<
        Entry<RawGroup>,
        { state: 'resolving' | 'done'; group?: ModelGroup }
    >();
    private attributeGroups = new Map<
        Entry<RawAttributeGroup>,
        { state: 'resolving' | 'done'; result?: NamedAttributeGroup }
    >();

    private aliasCounter = 0;

    constructor(private readonly set: SchemaSet) {
        this.diag = set.diagnostics;

        this.anySimpleType = this.builtin('anySimpleType')!;
        const anyWildcard: Wildcard = {
            kind: 'any',
            namespace: { kind: 'any' },
            processContents: 'lax',
            notQName: [],
        };
        this.anyType = {
            kind: 'complex',
            id: this.nextId++,
            name: qname(XSD_NS, 'anyType'),
            global: true,
            base: undefined as unknown as TypeDef,
            derivation: 'none',
            abstract: false,
            mixed: true,
            contentKind: 'mixed',
            particle: {
                min: 0,
                max: Infinity,
                term: {
                    kind: 'sequence',
                    particles: [{ min: 0, max: Infinity, term: anyWildcard }],
                },
            },
            attributes: [],
            ownAttributes: [],
            attributeWildcard: anyWildcard,
            block: [],
            final: [],
            assertions: [],
        };
        this.anyType.base = this.anyType;
        this.state.set(this.anyType, 'done');
        this.createXmlAttributes();
    }

    // -------------------------------------------------------------------------
    // diagnostics helpers
    // -------------------------------------------------------------------------

    private error(code: string, message: string, at?: Located): void {
        this.diag.error(code, message, at?.path, at?.file);
    }

    private warn(code: string, message: string, at?: Located): void {
        this.diag.warn(code, message, at?.path, at?.file);
    }

    // -------------------------------------------------------------------------
    // built-in types
    // -------------------------------------------------------------------------

    builtin(local: string): SimpleTypeDef | undefined {
        const cached = this.builtinDefs.get(local);
        if (cached) return cached;
        const info = BUILTINS.get(local);
        if (!info) return undefined;

        const def: SimpleTypeDef = {
            kind: 'simple',
            id: this.nextId++,
            name: qname(XSD_NS, local),
            global: true,
            variety: info.variety,
            builtin: info,
            facets: EMPTY_FACETS(),
            final: [],
            valueKind: info.valueKind,
        };
        this.builtinDefs.set(local, def);

        if (local !== 'anySimpleType') {
            def.base = this.builtin(info.base) ?? this.anySimpleType;
        }
        if (info.primitive) def.primitive = this.builtin(info.primitive);
        if (info.itemType) def.itemType = this.builtin(info.itemType);

        const own: RawFacet[] = Object.entries(info.own).map(
            ([name, value]) =>
                ({ name: name as FacetName, value, fixed: false } as RawFacet),
        );
        def.facets = this.mergeFacets(def.base?.facets ?? EMPTY_FACETS(), own);
        return def;
    }

    private createXmlAttributes(): void {
        const make = (local: string, type: SimpleTypeDef): void => {
            this.xmlAttributes.set(local, {
                kind: 'attribute',
                id: this.nextId++,
                name: qname(XML_NS, local),
                global: true,
                type,
                inheritable: false,
            });
        };
        const enumType = (values: string[]): SimpleTypeDef => ({
            kind: 'simple',
            id: this.nextId++,
            global: false,
            variety: 'atomic',
            base: this.builtin('token')!,
            primitive: this.builtin('string'),
            facets: {
                ...EMPTY_FACETS(),
                whiteSpace: 'collapse',
                enumeration: values,
            },
            final: [],
            valueKind: 'string',
        });
        make('lang', this.builtin('language')!);
        make('space', enumType(['default', 'preserve']));
        make('base', this.builtin('anyURI')!);
        make('id', this.builtin('ID')!);
    }

    // -------------------------------------------------------------------------
    // registration (pass 1) and redefine/override (pass 2)
    // -------------------------------------------------------------------------

    private register<R extends { name?: string }>(
        kind: Kind,
        raw: R,
        scope: DocScope,
    ): void {
        if (!raw.name) return;
        const name = qname(scope.tns, raw.name);
        const key = qkey(name);
        const existing = this.registry[kind].get(key);
        if (existing) {
            this.error(
                'duplicate-component',
                `${kind} ${key} is declared more than once (also in ${existing.scope.doc.location})`,
                raw as unknown as Located,
            );
            return;
        }
        this.registry[kind].set(key, { raw, scope, name });
    }

    private collect(): void {
        const scopes = new Map<SchemaDocument, DocScope>();
        for (const doc of this.set.documents) {
            const scope: DocScope = {
                doc,
                raw: doc.raw,
                tns: doc.targetNamespace,
            };
            scopes.set(doc, scope);
            for (const r of doc.raw.simpleTypes)
                this.register('type', r, scope);
            for (const r of doc.raw.complexTypes)
                this.register('type', r, scope);
            for (const r of doc.raw.groups) this.register('group', r, scope);
            for (const r of doc.raw.attributeGroups)
                this.register('attributeGroup', r, scope);
            for (const r of doc.raw.elements)
                this.register('element', r, scope);
            for (const r of doc.raw.attributes)
                this.register('attribute', r, scope);
            for (const r of doc.raw.notations)
                this.register('notation', r, scope);
        }

        // redefine / override: replace components registered by the target
        for (const doc of this.set.documents) {
            const scope = scopes.get(doc)!;
            for (const link of doc.links) {
                if (link.kind !== 'redefine' && link.kind !== 'override')
                    continue;
                const components = (
                    link.raw as { components: RawGlobalComponent[] }
                ).components;
                for (const comp of components) {
                    const kind = kindOf(comp);
                    const name = (comp as { name?: string }).name;
                    if (!name) continue;
                    const q = qname(doc.targetNamespace, name);
                    const key = qkey(q);
                    const existing = this.registry[kind].get(key);
                    if (!existing) {
                        this.error(
                            `${link.kind}-target-missing`,
                            `<${link.kind}> of ${kind} ${key}: the referenced schema does not define it`,
                            comp as Located,
                        );
                        continue;
                    }
                    if (link.kind === 'redefine') {
                        const aliasLocal = `${name}#original${++this
                            .aliasCounter}`;
                        const alias = qname(doc.targetNamespace, aliasLocal);
                        this.registry[kind].set(qkey(alias), {
                            ...existing,
                            name: alias,
                        });
                        this.rewriteSelfReferences(comp, q, alias);
                    }
                    this.registry[kind].set(key, { raw: comp, scope, name: q });
                }
            }
        }
    }

    /** Inside a `<redefine>`d component, references to itself mean the original. */
    private rewriteSelfReferences(
        comp: RawGlobalComponent,
        self: QName,
        alias: QName,
    ): void {
        const same = (q?: QName) =>
            q && q.ns === self.ns && q.local === self.local;
        const swap = (q: QName): QName => (same(q) ? { ...alias } : q);

        const walkParticle = (p: RawParticle | undefined): void => {
            if (!p) return;
            if (p.kind === 'group') {
                if (p.ref && same(p.ref)) p.ref = swap(p.ref);
            } else if (
                p.kind === 'sequence' ||
                p.kind === 'choice' ||
                p.kind === 'all'
            ) {
                p.particles.forEach(walkParticle);
            }
        };
        const walkAttrGroups = (
            items: Array<RawAttribute | RawAttributeGroup>,
        ) => {
            for (const item of items)
                if (
                    item.kind === 'attributeGroup' &&
                    item.ref &&
                    same(item.ref)
                )
                    item.ref = swap(item.ref);
        };

        switch (comp.kind) {
            case 'simpleType': {
                const d = comp.derivation;
                if (d.kind === 'restriction' && d.base) d.base = swap(d.base);
                break;
            }
            case 'complexType': {
                if (comp.content.form !== 'shorthand')
                    comp.content.base = swap(comp.content.base);
                break;
            }
            case 'group':
                walkParticle(comp.model);
                break;
            case 'attributeGroup':
                walkAttrGroups(comp.attributes);
                break;
        }
    }

    // -------------------------------------------------------------------------
    // lookups
    // -------------------------------------------------------------------------

    private typeShell(entry: Entry<RawType>): TypeDef {
        const existing = this.typeShells.get(entry);
        if (existing) return existing;
        const { raw, scope } = entry;
        let def: TypeDef;
        if (isTypeRaw(raw)) {
            def = this.newComplex(entry.name, true, raw);
        } else {
            def = this.newSimple(entry.name, true, raw);
        }
        this.typeShells.set(entry, def);
        this.typeSources.set(def, { raw, scope });
        return def;
    }

    private newSimple(
        name: QName | undefined,
        global: boolean,
        raw: RawSimpleType,
    ): SimpleTypeDef {
        return {
            kind: 'simple',
            id: this.nextId++,
            name,
            global,
            variety: 'atomic',
            facets: EMPTY_FACETS(),
            final: [],
            valueKind: 'string',
            annotation: raw.annotation,
            file: raw.file,
            path: raw.path,
        };
    }

    private newComplex(
        name: QName | undefined,
        global: boolean,
        raw: RawComplexType,
    ): ComplexTypeDef {
        return {
            kind: 'complex',
            id: this.nextId++,
            name,
            global,
            base: this.anyType,
            derivation: 'restriction',
            abstract: raw.abstract,
            mixed: false,
            contentKind: 'empty',
            attributes: [],
            ownAttributes: [],
            block: [],
            final: [],
            assertions: [],
            annotation: raw.annotation,
            file: raw.file,
            path: raw.path,
        };
    }

    private typeFromQName(q: QName, at: Located): TypeDef | undefined {
        if (q.ns === XSD_NS) {
            if (q.local === 'anyType') return this.anyType;
            const builtin = this.builtin(q.local);
            if (!builtin)
                this.error(
                    'unknown-builtin-type',
                    `"${q.local}" is not a built-in XML Schema datatype`,
                    at,
                );
            return builtin;
        }
        const entry = this.registry.type.get(qkey(q));
        if (!entry) {
            this.error(
                'unresolved-reference',
                `type "${qkey(q)}" is not defined`,
                at,
            );
            return undefined;
        }
        return this.typeShell(entry);
    }

    private simpleFromQName(q: QName, at: Located): SimpleTypeDef {
        const t = this.typeFromQName(q, at);
        if (!t) return this.anySimpleType;
        if (t.kind === 'complex') {
            this.error(
                'not-a-simple-type',
                `"${qkey(
                    q,
                )}" is a complex type but a simple type is required here`,
                at,
            );
            return this.anySimpleType;
        }
        this.ensureComplete(t);
        return t;
    }

    private elementShell(entry: Entry<RawElement>): ElementDecl {
        const existing = this.elementShells.get(entry);
        if (existing) return existing;
        const { raw, scope } = entry;
        const decl: ElementDecl = {
            kind: 'element',
            id: this.nextId++,
            name: entry.name,
            global: true,
            type: this.anyType,
            nillable: raw.nillable,
            default: raw.default,
            fixed: raw.fixed,
            abstract: raw.abstract,
            substitutes: [],
            block: raw.block.length ? raw.block : scope.raw.blockDefault,
            final: raw.final.length
                ? raw.final
                : scope.raw.finalDefault.filter(
                      d => d === 'extension' || d === 'restriction',
                  ),
            identity: [],
            alternatives: [],
            annotation: raw.annotation,
            file: raw.file,
            path: raw.path,
        };
        this.elementShells.set(entry, decl);
        this.elementSources.set(decl, { raw, scope });
        return decl;
    }

    private attributeShell(entry: Entry<RawAttribute>): AttributeDecl {
        const existing = this.attributeShells.get(entry);
        if (existing) return existing;
        const { raw, scope } = entry;
        const decl: AttributeDecl = {
            kind: 'attribute',
            id: this.nextId++,
            name: entry.name,
            global: true,
            type: this.anySimpleType,
            default: raw.default,
            fixed: raw.fixed,
            inheritable: raw.inheritable,
            annotation: raw.annotation,
            file: raw.file,
            path: raw.path,
        };
        this.attributeShells.set(entry, decl);
        this.attributeSources.set(decl, { raw, scope });
        return decl;
    }

    private globalElement(q: QName, at: Located): ElementDecl | undefined {
        const entry = this.registry.element.get(qkey(q));
        if (!entry) {
            this.error(
                'unresolved-reference',
                `element "${qkey(q)}" is not defined`,
                at,
            );
            return undefined;
        }
        return this.elementShell(entry);
    }

    private globalAttribute(q: QName, at: Located): AttributeDecl | undefined {
        const entry = this.registry.attribute.get(qkey(q));
        if (entry) {
            const decl = this.attributeShell(entry);
            this.ensureAttribute(decl);
            return decl;
        }
        if (q.ns === XML_NS && this.xmlAttributes.has(q.local))
            return this.xmlAttributes.get(q.local);
        this.error(
            'unresolved-reference',
            `attribute "${qkey(q)}" is not defined`,
            at,
        );
        return undefined;
    }

    // -------------------------------------------------------------------------
    // facets
    // -------------------------------------------------------------------------

    private mergeFacets(
        base: ResolvedFacets,
        own: Array<Pick<RawFacet, 'name' | 'value' | 'test'>>,
    ): ResolvedFacets {
        const result: ResolvedFacets = {
            ...base,
            patterns: base.patterns.map(p => [...p]),
            enumeration: base.enumeration ? [...base.enumeration] : undefined,
            assertions: [...base.assertions],
        };
        const stepPatterns: string[] = [];
        const stepEnum: string[] = [];
        for (const f of own) {
            switch (f.name) {
                case 'length':
                case 'minLength':
                case 'maxLength':
                case 'totalDigits':
                case 'fractionDigits':
                    result[f.name] = Number(f.value);
                    break;
                case 'whiteSpace':
                    result.whiteSpace = f.value as ResolvedFacets['whiteSpace'];
                    break;
                case 'minInclusive':
                case 'maxInclusive':
                case 'minExclusive':
                case 'maxExclusive':
                    result[f.name] = f.value;
                    break;
                case 'explicitTimezone':
                    result.explicitTimezone =
                        f.value as ResolvedFacets['explicitTimezone'];
                    break;
                case 'pattern':
                    stepPatterns.push(f.value);
                    break;
                case 'enumeration':
                    stepEnum.push(f.value);
                    break;
                case 'assertion':
                    if (f.test) result.assertions.push(f.test);
                    break;
            }
        }
        if (stepPatterns.length) result.patterns.push(stepPatterns);
        if (stepEnum.length) result.enumeration = stepEnum;
        return result;
    }

    private checkFacetApplicability(
        base: SimpleTypeDef,
        facets: RawFacet[],
    ): void {
        let allowed: readonly FacetName[];
        if (base.variety === 'list')
            allowed = [
                'length',
                'minLength',
                'maxLength',
                'pattern',
                'enumeration',
                'whiteSpace',
                'assertion',
            ];
        else if (base.variety === 'union')
            allowed = ['pattern', 'enumeration', 'assertion'];
        else
            allowed =
                base.primitive?.builtin?.facets ?? base.builtin?.facets ?? [];
        if (base === this.anySimpleType) return;
        for (const f of facets) {
            if (!allowed.includes(f.name))
                this.warn(
                    'facet-not-applicable',
                    `facet <${f.name}> does not apply to types derived from ${
                        base.primitive?.name?.local ??
                        base.name?.local ??
                        'this type'
                    }`,
                    f,
                );
        }
    }

    // -------------------------------------------------------------------------
    // simple types
    // -------------------------------------------------------------------------

    private compileAnonymousSimple(
        raw: RawSimpleType,
        scope: DocScope,
    ): SimpleTypeDef {
        const def = this.newSimple(undefined, false, raw);
        this.typeSources.set(def, { raw, scope });
        this.ensureComplete(def);
        return def;
    }

    private completeSimple(
        def: SimpleTypeDef,
        raw: RawSimpleType,
        scope: DocScope,
    ): void {
        def.final = raw.final.length ? raw.final : scope.raw.finalDefault;
        const d = raw.derivation;

        if (d.kind === 'restriction') {
            const base = d.base
                ? this.simpleFromQName(d.base, d)
                : d.inline
                ? this.compileAnonymousSimple(d.inline, scope)
                : this.anySimpleType;
            this.checkDerivation(base, 'restriction', d);
            def.base = base;
            def.variety = base.variety;
            def.primitive = base.primitive;
            def.itemType = base.itemType;
            def.memberTypes = base.memberTypes;
            def.valueKind = base.valueKind;
            this.checkFacetApplicability(base, d.facets);
            def.facets = this.mergeFacets(base.facets, d.facets);
            return;
        }

        def.base = this.anySimpleType;
        if (d.kind === 'list') {
            const item = d.itemType
                ? this.simpleFromQName(d.itemType, d)
                : d.inline
                ? this.compileAnonymousSimple(d.inline, scope)
                : this.anySimpleType;
            if (item.variety === 'list')
                this.error(
                    'list-of-list',
                    'the item type of a list cannot itself be a list',
                    d,
                );
            def.variety = 'list';
            def.itemType = item;
            def.valueKind = item.valueKind;
            def.facets = this.mergeFacets(EMPTY_FACETS(), [
                { name: 'whiteSpace', value: 'collapse' },
            ]);
            return;
        }

        // union
        const members = [
            ...d.memberTypes.map(q => this.simpleFromQName(q, d)),
            ...d.inline.map(i => this.compileAnonymousSimple(i, scope)),
        ];
        def.variety = 'union';
        def.memberTypes = members;
        const kinds = new Set(members.map(m => m.valueKind));
        def.valueKind = kinds.size === 1 ? [...kinds][0] : 'unknown';
    }

    private checkDerivation(
        base: TypeDef,
        method: DerivationMethod,
        at: Located,
    ): void {
        if (base.final.includes(method))
            this.warn(
                'derivation-blocked',
                `${
                    base.name ? qkey(base.name) : 'the base type'
                } is final for ${method}`,
                at,
            );
    }

    // -------------------------------------------------------------------------
    // completion driver
    // -------------------------------------------------------------------------

    private ensureComplete(def: TypeDef): void {
        const st = this.state.get(def);
        if (st === 'done') return;
        const source = this.typeSources.get(def);
        if (!source) {
            this.state.set(def, 'done');
            return;
        }
        if (st === 'resolving') {
            this.error(
                'circular-definition',
                `type ${
                    def.name ? qkey(def.name) : '(anonymous)'
                } is defined in terms of itself`,
                source.raw,
            );
            return;
        }
        this.state.set(def, 'resolving');
        if (def.kind === 'simple')
            this.completeSimple(def, source.raw as RawSimpleType, source.scope);
        else
            this.completeComplex(
                def,
                source.raw as RawComplexType,
                source.scope,
            );
        this.state.set(def, 'done');
    }

    private ensureElement(decl: ElementDecl): void {
        const st = this.state.get(decl);
        if (st === 'done' || st === 'resolving') return;
        const source = this.elementSources.get(decl);
        if (!source) return;
        this.state.set(decl, 'resolving');
        this.fillElement(decl, source.raw, source.scope);
        this.state.set(decl, 'done');
    }

    private ensureAttribute(decl: AttributeDecl): void {
        const st = this.state.get(decl);
        if (st === 'done' || st === 'resolving') return;
        const source = this.attributeSources.get(decl);
        if (!source) return;
        this.state.set(decl, 'resolving');
        decl.type = this.attributeType(source.raw, source.scope);
        this.state.set(decl, 'done');
    }

    private attributeType(raw: RawAttribute, scope: DocScope): SimpleTypeDef {
        if (raw.type) return this.simpleFromQName(raw.type, raw);
        if (raw.inlineType)
            return this.compileAnonymousSimple(raw.inlineType, scope);
        return this.anySimpleType;
    }

    // -------------------------------------------------------------------------
    // elements
    // -------------------------------------------------------------------------

    private fillElement(
        decl: ElementDecl,
        raw: RawElement,
        scope: DocScope,
    ): void {
        const head = raw.substitutionGroup[0]
            ? this.globalElement(raw.substitutionGroup[0], raw)
            : undefined;
        if (head) {
            this.ensureElement(head);
            decl.substitutionGroup = head;
        }

        if (raw.type) {
            decl.type = this.typeFromQName(raw.type, raw) ?? this.anyType;
        } else if (raw.inlineType) {
            decl.type = this.compileAnonymous(raw.inlineType, scope);
        } else if (head) {
            decl.type = head.type;
        } else {
            decl.type = this.anyType;
        }

        decl.identity = raw.identity.map(i => this.identity(i));
        decl.alternatives = raw.alternatives
            .map(alt => {
                const type = alt.type
                    ? this.typeFromQName(alt.type, alt)
                    : alt.inlineType
                    ? this.compileAnonymous(alt.inlineType, scope)
                    : undefined;
                return type ? { test: alt.test, type } : undefined;
            })
            .filter((x): x is NonNullable<typeof x> => x !== undefined);
    }

    private identity(raw: RawIdentityConstraint): IdentityConstraint {
        return {
            kind: raw.kind,
            name: raw.name,
            refer: raw.refer,
            selector: raw.selector,
            fields: raw.fields,
            annotation: raw.annotation,
            file: raw.file,
            path: raw.path,
        };
    }

    private compileAnonymous(raw: RawType, scope: DocScope): TypeDef {
        if (isTypeRaw(raw)) {
            const def = this.newComplex(undefined, false, raw);
            this.typeSources.set(def, { raw, scope });
            this.ensureComplete(def);
            return def;
        }
        return this.compileAnonymousSimple(raw, scope);
    }

    private localElement(
        raw: RawElement,
        scope: DocScope,
    ): ElementDecl | undefined {
        if (raw.ref) {
            const decl = this.globalElement(raw.ref, raw);
            return decl;
        }
        if (!raw.name) return undefined;
        const form = raw.form ?? scope.raw.elementFormDefault;
        const ns =
            raw.targetNamespace ?? (form === 'qualified' ? scope.tns : '');
        const decl: ElementDecl = {
            kind: 'element',
            id: this.nextId++,
            name: qname(ns, raw.name),
            global: false,
            type: this.anyType,
            nillable: raw.nillable,
            default: raw.default,
            fixed: raw.fixed,
            abstract: false,
            substitutes: [],
            block: raw.block.length ? raw.block : scope.raw.blockDefault,
            final: [],
            identity: [],
            alternatives: [],
            annotation: raw.annotation,
            file: raw.file,
            path: raw.path,
        };
        this.elementSources.set(decl, { raw, scope });
        this.state.set(decl, 'resolving');
        this.fillElement(decl, raw, scope);
        this.state.set(decl, 'done');
        return decl;
    }

    // -------------------------------------------------------------------------
    // particles
    // -------------------------------------------------------------------------

    private compileParticle(
        raw: RawParticle,
        scope: DocScope,
    ): Particle | undefined {
        // a particle that can never occur is removed from the content model
        if (raw.occurs.max === 0) return undefined;
        const { min, max } = raw.occurs;

        switch (raw.kind) {
            case 'element': {
                const decl = this.localElement(raw, scope);
                return decl ? { min, max, term: decl } : undefined;
            }
            case 'any':
                return { min, max, term: this.compileWildcard(raw) };
            case 'group': {
                if (!raw.ref) return undefined;
                const entry = this.registry.group.get(qkey(raw.ref));
                if (!entry) {
                    this.error(
                        'unresolved-reference',
                        `group "${qkey(raw.ref)}" is not defined`,
                        raw,
                    );
                    return undefined;
                }
                const group = this.compileGroup(entry);
                return group ? { min, max, term: group } : undefined;
            }
            default: {
                const group = this.compileModelGroup(
                    raw as RawModelGroup,
                    scope,
                );
                return { min, max, term: group };
            }
        }
    }

    private compileModelGroup(raw: RawModelGroup, scope: DocScope): ModelGroup {
        const particles: Particle[] = [];
        for (const p of raw.particles) {
            const compiled = this.compileParticle(p, scope);
            if (compiled) particles.push(compiled);
        }
        return {
            kind: raw.kind,
            particles,
            annotation: raw.annotation,
            file: raw.file,
            path: raw.path,
        };
    }

    private compileGroup(entry: Entry<RawGroup>): ModelGroup | undefined {
        const cached = this.groups.get(entry);
        if (cached) {
            if (cached.state === 'resolving') {
                this.error(
                    'circular-definition',
                    `group "${qkey(entry.name)}" refers to itself`,
                    entry.raw,
                );
                return undefined;
            }
            return cached.group;
        }
        const record: { state: 'resolving' | 'done'; group?: ModelGroup } = {
            state: 'resolving',
        };
        this.groups.set(entry, record);
        if (entry.raw.model) {
            record.group = this.compileModelGroup(entry.raw.model, entry.scope);
            record.group.origin = entry.name;
            if (!record.group.annotation)
                record.group.annotation = entry.raw.annotation;
        }
        record.state = 'done';
        return record.group;
    }

    private compileWildcard(raw: RawWildcard): Wildcard {
        const tokens = (value: string): string[] =>
            value
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map(t =>
                    t === '##local'
                        ? ''
                        : t === '##targetNamespace'
                        ? raw.targetNamespace
                        : t,
                );
        let namespace: NamespaceConstraint;
        if (raw.notNamespace !== undefined) {
            namespace = { kind: 'not', namespaces: tokens(raw.notNamespace) };
        } else {
            const ns = raw.namespace.trim();
            if (ns === '##any' || ns === '') namespace = { kind: 'any' };
            else if (ns === '##other')
                namespace = { kind: 'other', ns: raw.targetNamespace };
            else namespace = { kind: 'list', namespaces: tokens(ns) };
        }
        return {
            kind: 'any',
            namespace,
            processContents: raw.processContents,
            notQName: raw.notQName ? raw.notQName.trim().split(/\s+/) : [],
        };
    }

    private combine(a?: Particle, b?: Particle): Particle | undefined {
        if (!a) return b;
        if (!b) return a;
        return {
            min: 1,
            max: 1,
            term: { kind: 'sequence', particles: [a, b] },
        };
    }

    // -------------------------------------------------------------------------
    // wildcards
    // -------------------------------------------------------------------------

    private unionWildcards(a?: Wildcard, b?: Wildcard): Wildcard | undefined {
        if (!a) return b;
        if (!b) return a;
        const ca = a.namespace;
        const cb = b.namespace;
        let namespace: NamespaceConstraint;
        if (ca.kind === 'any' || cb.kind === 'any') namespace = { kind: 'any' };
        else if (ca.kind === 'list' && cb.kind === 'list')
            namespace = {
                kind: 'list',
                namespaces: [...new Set([...ca.namespaces, ...cb.namespaces])],
            };
        else if (ca.kind === 'other' && cb.kind === 'other' && ca.ns === cb.ns)
            namespace = ca;
        else namespace = { kind: 'any' };
        return { ...a, namespace };
    }

    private intersectWildcards(
        a?: Wildcard,
        b?: Wildcard,
    ): Wildcard | undefined {
        if (!a) return b;
        if (!b) return a;
        const ca = a.namespace;
        const cb = b.namespace;
        if (ca.kind === 'any') return b;
        if (cb.kind === 'any') return a;
        if (ca.kind === 'list' && cb.kind === 'list')
            return {
                ...a,
                namespace: {
                    kind: 'list',
                    namespaces: ca.namespaces.filter(n =>
                        cb.namespaces.includes(n),
                    ),
                },
            };
        if (ca.kind === 'list' && cb.kind === 'other')
            return {
                ...a,
                namespace: {
                    kind: 'list',
                    namespaces: ca.namespaces.filter(
                        n => n !== '' && n !== cb.ns,
                    ),
                },
            };
        if (ca.kind === 'other' && cb.kind === 'list')
            return {
                ...b,
                namespace: {
                    kind: 'list',
                    namespaces: cb.namespaces.filter(
                        n => n !== '' && n !== ca.ns,
                    ),
                },
            };
        return a;
    }

    // -------------------------------------------------------------------------
    // attributes
    // -------------------------------------------------------------------------

    private localAttribute(
        raw: RawAttribute,
        scope: DocScope,
    ): AttributeUse | undefined {
        let decl: AttributeDecl | undefined;
        if (raw.ref) {
            decl = this.globalAttribute(raw.ref, raw);
        } else if (raw.name) {
            const form = raw.form ?? scope.raw.attributeFormDefault;
            const ns =
                raw.targetNamespace ?? (form === 'qualified' ? scope.tns : '');
            decl = {
                kind: 'attribute',
                id: this.nextId++,
                name: qname(ns, raw.name),
                global: false,
                type: this.attributeType(raw, scope),
                default: raw.default,
                fixed: raw.fixed,
                inheritable: raw.inheritable,
                annotation: raw.annotation,
                file: raw.file,
                path: raw.path,
            };
        }
        if (!decl) return undefined;
        return {
            decl,
            use: raw.use,
            default: raw.ref ? raw.default : undefined,
            fixed: raw.ref ? raw.fixed : undefined,
        };
    }

    private compileAttributeGroup(
        entry: Entry<RawAttributeGroup>,
    ): NamedAttributeGroup | undefined {
        const cached = this.attributeGroups.get(entry);
        if (cached) {
            if (cached.state === 'resolving') {
                this.error(
                    'circular-definition',
                    `attribute group "${qkey(entry.name)}" refers to itself`,
                    entry.raw,
                );
                return undefined;
            }
            return cached.result;
        }
        const record: {
            state: 'resolving' | 'done';
            result?: NamedAttributeGroup;
        } = { state: 'resolving' };
        this.attributeGroups.set(entry, record);
        const { uses, wildcard } = this.attributeUses(
            entry.raw.attributes,
            entry.raw.anyAttribute,
            entry.scope,
        );
        record.result = {
            name: entry.name,
            attributes: uses,
            wildcard,
            annotation: entry.raw.annotation,
            file: entry.raw.file,
            path: entry.raw.path,
        };
        record.state = 'done';
        return record.result;
    }

    /** Expand attributes and attribute groups. Prohibited uses are kept here. */
    private attributeUses(
        items: Array<RawAttribute | RawAttributeGroup>,
        anyAttribute: RawWildcard | undefined,
        scope: DocScope,
    ): { uses: AttributeUse[]; wildcard?: Wildcard } {
        const uses = new Map<string, AttributeUse>();
        let wildcard = anyAttribute
            ? this.compileWildcard(anyAttribute)
            : undefined;
        let groupWildcard: Wildcard | undefined;
        let sawGroupWildcard = false;

        for (const item of items) {
            if (item.kind === 'attribute') {
                const use = this.localAttribute(item, scope);
                if (!use) continue;
                const key = qkey(use.decl.name);
                if (uses.has(key))
                    this.error(
                        'duplicate-attribute',
                        `attribute "${key}" is declared more than once`,
                        item,
                    );
                uses.set(key, use);
                continue;
            }
            if (!item.ref) continue;
            const entry = this.registry.attributeGroup.get(qkey(item.ref));
            if (!entry) {
                this.error(
                    'unresolved-reference',
                    `attribute group "${qkey(item.ref)}" is not defined`,
                    item,
                );
                continue;
            }
            const group = this.compileAttributeGroup(entry);
            if (!group) continue;
            for (const use of group.attributes) {
                const key = qkey(use.decl.name);
                if (!uses.has(key)) uses.set(key, use);
            }
            if (group.wildcard) {
                groupWildcard = sawGroupWildcard
                    ? this.intersectWildcards(groupWildcard, group.wildcard)
                    : group.wildcard;
                sawGroupWildcard = true;
            }
        }
        if (sawGroupWildcard)
            wildcard = wildcard
                ? this.intersectWildcards(wildcard, groupWildcard)
                : groupWildcard;
        return { uses: [...uses.values()], wildcard };
    }

    // -------------------------------------------------------------------------
    // complex types
    // -------------------------------------------------------------------------

    private openContent(
        raw: RawOpenContent | undefined,
        scope: DocScope,
        isEmptyContent: boolean,
    ): OpenContent | undefined {
        let source: RawOpenContent | undefined = raw;
        if (!source) {
            const d = scope.raw.defaultOpenContent;
            if (d && (!isEmptyContent || d.appliesToEmpty)) source = d;
        }
        if (!source || source.mode === 'none' || !source.wildcard)
            return undefined;
        return {
            mode: source.mode,
            wildcard: this.compileWildcard(source.wildcard),
        };
    }

    private completeComplex(
        def: ComplexTypeDef,
        raw: RawComplexType,
        scope: DocScope,
    ): void {
        def.block = raw.block.length
            ? raw.block
            : scope.raw.blockDefault.filter(
                  d => d === 'extension' || d === 'restriction',
              );
        def.final = raw.final.length
            ? raw.final
            : scope.raw.finalDefault.filter(
                  d => d === 'extension' || d === 'restriction',
              );
        def.assertions = raw.assertions;

        const content = raw.content;

        // -- shorthand: implicit restriction of anyType --------------------------
        if (content.form === 'shorthand') {
            const own = content.particle
                ? this.compileParticle(content.particle, scope)
                : undefined;
            const { uses, wildcard } = this.attributeUses(
                content.attributes,
                content.anyAttribute,
                scope,
            );
            def.base = this.anyType;
            def.derivation = 'restriction';
            def.mixed = raw.mixed ?? false;
            def.particle = own;
            def.ownParticle = own;
            def.ownAttributes = uses;
            def.attributes = uses.filter(u => u.use !== 'prohibited');
            def.attributeWildcard = wildcard;
            def.contentKind = def.mixed
                ? 'mixed'
                : own
                ? 'elementOnly'
                : 'empty';
            def.openContent = this.openContent(raw.openContent, scope, !own);
            return;
        }

        // -- simple content --------------------------------------------------------
        if (content.form === 'simple') {
            const base =
                this.typeFromQName(content.base, content) ?? this.anySimpleType;
            this.ensureComplete(base);
            this.checkDerivation(base, content.derivation, content);
            const { uses, wildcard } = this.attributeUses(
                content.attributes,
                content.anyAttribute,
                scope,
            );

            let value: SimpleTypeDef;
            let inheritedUses: AttributeUse[] = [];
            let inheritedWildcard: Wildcard | undefined;

            if (base.kind === 'complex') {
                if (base.contentKind !== 'simple' || !base.simpleValue) {
                    this.error(
                        'simplecontent-base',
                        `the base type of <simpleContent> must have simple content`,
                        content,
                    );
                }
                value = base.simpleValue ?? this.anySimpleType;
                inheritedUses = base.attributes;
                inheritedWildcard = base.attributeWildcard;
            } else {
                value = base;
            }

            if (content.derivation === 'restriction') {
                if (content.inlineSimple)
                    value = this.compileAnonymousSimple(
                        content.inlineSimple,
                        scope,
                    );
                if (content.facets.length) {
                    this.checkFacetApplicability(value, content.facets);
                    value = this.deriveSimple(value, content.facets);
                }
            }

            def.base = base;
            def.derivation = content.derivation;
            def.contentKind = 'simple';
            def.simpleValue = value;
            def.mixed = false;
            def.ownAttributes = uses;
            def.attributes = this.mergeAttributes(
                inheritedUses,
                uses,
                content.derivation,
            );
            def.attributeWildcard =
                content.derivation === 'extension'
                    ? this.unionWildcards(inheritedWildcard, wildcard)
                    : wildcard;
            return;
        }

        // -- complex content -------------------------------------------------------
        const baseType =
            this.typeFromQName(content.base, content) ?? this.anyType;
        let base: ComplexTypeDef;
        if (baseType.kind === 'simple') {
            this.error(
                'complexcontent-base',
                `the base type of <complexContent> must be a complex type`,
                content,
            );
            base = this.anyType;
        } else {
            base = baseType;
        }
        this.ensureComplete(base);
        this.checkDerivation(base, content.derivation, content);

        const own = content.particle
            ? this.compileParticle(content.particle, scope)
            : undefined;
        const { uses, wildcard } = this.attributeUses(
            content.attributes,
            content.anyAttribute,
            scope,
        );
        const baseIsAny = base === this.anyType;

        def.base = base;
        def.derivation = content.derivation;
        def.ownParticle = own;
        def.ownAttributes = uses;
        def.mixed =
            content.mixed ??
            raw.mixed ??
            (content.derivation === 'extension'
                ? base.mixed && !baseIsAny
                : false);

        if (content.derivation === 'extension') {
            def.particle = baseIsAny ? own : this.combine(base.particle, own);
            def.attributes = this.mergeAttributes(
                baseIsAny ? [] : base.attributes,
                uses,
                'extension',
            );
            def.attributeWildcard = baseIsAny
                ? wildcard
                : this.unionWildcards(base.attributeWildcard, wildcard);
            if (base.contentKind === 'simple' && !own) {
                def.contentKind = 'simple';
                def.simpleValue = base.simpleValue;
            } else {
                def.contentKind = def.mixed
                    ? 'mixed'
                    : def.particle
                    ? 'elementOnly'
                    : 'empty';
            }
            def.openContent =
                this.openContent(
                    raw.openContent ?? content.openContent,
                    scope,
                    !def.particle,
                ) ?? (baseIsAny ? undefined : base.openContent);
        } else {
            def.particle = own;
            def.attributes = this.mergeAttributes(
                base.attributes,
                uses,
                'restriction',
            );
            def.attributeWildcard = wildcard;
            def.contentKind = def.mixed
                ? 'mixed'
                : own
                ? 'elementOnly'
                : 'empty';
            def.openContent = this.openContent(
                raw.openContent ?? content.openContent,
                scope,
                !own,
            );
        }
    }

    private mergeAttributes(
        inherited: AttributeUse[],
        own: AttributeUse[],
        derivation: 'extension' | 'restriction',
    ): AttributeUse[] {
        const result = new Map<string, AttributeUse>();
        for (const use of inherited) result.set(qkey(use.decl.name), use);
        if (derivation === 'restriction') {
            for (const use of own) {
                const key = qkey(use.decl.name);
                if (use.use === 'prohibited') result.delete(key);
                else result.set(key, use);
            }
        } else {
            for (const use of own) {
                if (use.use === 'prohibited') continue;
                result.set(qkey(use.decl.name), use);
            }
        }
        return [...result.values()].filter(u => u.use !== 'prohibited');
    }

    private deriveSimple(
        base: SimpleTypeDef,
        facets: RawFacet[],
    ): SimpleTypeDef {
        return {
            kind: 'simple',
            id: this.nextId++,
            global: false,
            variety: base.variety,
            base,
            primitive: base.primitive,
            itemType: base.itemType,
            memberTypes: base.memberTypes,
            facets: this.mergeFacets(base.facets, facets),
            final: [],
            valueKind: base.valueKind,
        };
    }

    // -------------------------------------------------------------------------
    // driver
    // -------------------------------------------------------------------------

    compile(): CompiledSchema {
        this.collect();

        // shells first so every reference can be wired
        const typeShells = [...this.registry.type.values()].map(e =>
            this.typeShell(e),
        );
        const elementShells = [...this.registry.element.values()].map(e =>
            this.elementShell(e),
        );
        const attributeShells = [...this.registry.attribute.values()].map(e =>
            this.attributeShell(e),
        );

        for (const t of typeShells) this.ensureComplete(t);
        for (const a of attributeShells) this.ensureAttribute(a);
        for (const e of elementShells) this.ensureElement(e);

        const groups = new Map<string, NamedGroup>();
        for (const [key, entry] of this.registry.group) {
            const group = this.compileGroup(entry);
            if (group)
                groups.set(key, {
                    name: entry.name,
                    group,
                    annotation: entry.raw.annotation,
                    file: entry.raw.file,
                    path: entry.raw.path,
                });
        }
        const attributeGroups = new Map<string, NamedAttributeGroup>();
        for (const [key, entry] of this.registry.attributeGroup) {
            const result = this.compileAttributeGroup(entry);
            if (result) attributeGroups.set(key, result);
        }

        this.computeSubstitutions(elementShells);
        this.checkComplexTypeRules(typeShells);

        const notations = new Map<string, RawNotation>();
        for (const [key, entry] of this.registry.notation)
            notations.set(key, entry.raw);

        const elements = new Map<string, ElementDecl>();
        for (const [key, entry] of this.registry.element)
            elements.set(key, this.elementShell(entry));
        const attributes = new Map<string, AttributeDecl>();
        for (const [key, entry] of this.registry.attribute)
            attributes.set(key, this.attributeShell(entry));
        const types = new Map<string, TypeDef>();
        for (const [key, entry] of this.registry.type)
            types.set(key, this.typeShell(entry));

        return {
            elements,
            attributes,
            types,
            groups,
            attributeGroups,
            notations,
            targetNamespaces: [
                ...new Set(this.set.documents.map(d => d.targetNamespace)),
            ],
            documents: this.set.documents.map(d => d.location),
            diagnostics: this.diag.items,
            anyType: this.anyType,
            anySimpleType: this.anySimpleType,
            builtin: (local: string) => this.builtin(local),
        };
    }

    private computeSubstitutions(elements: ElementDecl[]): void {
        for (const el of elements) {
            const seen = new Set<ElementDecl>([el]);
            for (
                let head = el.substitutionGroup;
                head && !seen.has(head);
                head = head.substitutionGroup
            ) {
                seen.add(head);
                if (!head.substitutes.includes(el)) head.substitutes.push(el);
            }
        }
    }

    private checkComplexTypeRules(types: TypeDef[]): void {
        for (const t of types) {
            if (t.kind !== 'complex') continue;
            if (t.contentKind === 'simple' && t.particle)
                this.warn(
                    'content-model-conflict',
                    'a complex type cannot have both simple content and element content',
                    t,
                );
        }
    }
}

/** Resolve and evaluate every component of a loaded schema set. */
export const compileSchemaSet = (
    set: SchemaSet,
    options: CompileOptions = {},
): CompiledSchema => {
    const compiler = new Compiler(set);
    const compiled = compiler.compile();
    if (options.strict) set.diagnostics.throwIfErrors();
    return compiled;
};
