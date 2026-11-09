import { QName } from '../names';
import { Diagnostic } from '../diagnostics';
import { BuiltinTypeInfo, ValueKind, WhiteSpace } from '../datatypes/builtins';
import { Annotation, DerivationMethod, RawNotation } from '../rules/raw';

/**
 * The compiled schema model: fully resolved components. References have been
 * replaced by the components they point to, named groups and attribute groups
 * are expanded, derivation has been evaluated and facets accumulated.
 */

export interface Component {
    annotation?: Annotation;
    /** Document location the component was declared in. */
    file?: string;
    /** Path of the declaring node, for diagnostics. */
    path?: string;
}

// -- facets -------------------------------------------------------------------

export interface ResolvedFacets {
    length?: number;
    minLength?: number;
    maxLength?: number;
    /** One entry per derivation step; a value must match at least one pattern of every step. */
    patterns: string[][];
    enumeration?: string[];
    whiteSpace?: WhiteSpace;
    minInclusive?: string;
    maxInclusive?: string;
    minExclusive?: string;
    maxExclusive?: string;
    totalDigits?: number;
    fractionDigits?: number;
    explicitTimezone?: 'required' | 'prohibited' | 'optional';
    assertions: string[];
}

// -- simple types -------------------------------------------------------------

export interface SimpleTypeDef extends Component {
    kind: 'simple';
    id: number;
    name?: QName;
    global: boolean;
    variety: 'atomic' | 'list' | 'union';
    /** `undefined` only for `anySimpleType`. */
    base?: SimpleTypeDef;
    /** Set for built-in types. */
    builtin?: BuiltinTypeInfo;
    /** Primitive ancestor of an atomic type (a built-in primitive). */
    primitive?: SimpleTypeDef;
    itemType?: SimpleTypeDef;
    memberTypes?: SimpleTypeDef[];
    /** Effective facets (base facets accumulated with this step's). */
    facets: ResolvedFacets;
    final: DerivationMethod[];
    /** How values are represented in JavaScript (items for lists). */
    valueKind: ValueKind;
}

// -- wildcards ----------------------------------------------------------------

export type NamespaceConstraint =
    | { kind: 'any' }
    /** Any namespace except `ns` and no-namespace (`##other`). */
    | { kind: 'other'; ns: string }
    | { kind: 'list'; namespaces: string[] }
    /** XSD 1.1 `notNamespace`. */
    | { kind: 'not'; namespaces: string[] };

export interface Wildcard {
    kind: 'any';
    namespace: NamespaceConstraint;
    processContents: 'strict' | 'lax' | 'skip';
    notQName: string[];
}

// -- declarations -------------------------------------------------------------

export interface IdentityConstraint extends Component {
    kind: 'unique' | 'key' | 'keyref';
    name: string;
    refer?: QName;
    selector: string;
    fields: string[];
}

export interface TypeAlternative {
    test?: string;
    type: TypeDef;
}

export interface ElementDecl extends Component {
    kind: 'element';
    id: number;
    name: QName;
    global: boolean;
    type: TypeDef;
    nillable: boolean;
    default?: string;
    fixed?: string;
    abstract: boolean;
    /** Head of the substitution group this element belongs to. */
    substitutionGroup?: ElementDecl;
    /** Every element that can substitute for this one (transitive). */
    substitutes: ElementDecl[];
    block: DerivationMethod[];
    final: DerivationMethod[];
    identity: IdentityConstraint[];
    alternatives: TypeAlternative[];
}

export interface AttributeDecl extends Component {
    kind: 'attribute';
    id: number;
    name: QName;
    global: boolean;
    type: SimpleTypeDef;
    default?: string;
    fixed?: string;
    inheritable: boolean;
}

export interface AttributeUse {
    decl: AttributeDecl;
    use: 'optional' | 'required' | 'prohibited';
    default?: string;
    fixed?: string;
}

// -- content models -----------------------------------------------------------

export interface ModelGroup extends Component {
    kind: 'sequence' | 'choice' | 'all';
    particles: Particle[];
    /** Name of the `<group>` definition this was expanded from. */
    origin?: QName;
}

export interface Particle {
    min: number;
    /** `Infinity` for `unbounded`. */
    max: number;
    term: ElementDecl | ModelGroup | Wildcard;
}

export interface OpenContent {
    mode: 'interleave' | 'suffix';
    wildcard: Wildcard;
}

// -- complex types ------------------------------------------------------------

export type ContentKind = 'empty' | 'simple' | 'elementOnly' | 'mixed';

export interface ComplexTypeDef extends Component {
    kind: 'complex';
    id: number;
    name?: QName;
    global: boolean;
    base: TypeDef;
    /** `none` only for `anyType` itself. */
    derivation: 'extension' | 'restriction' | 'none';
    abstract: boolean;
    mixed: boolean;
    contentKind: ContentKind;
    /** Value type when `contentKind` is `simple`. */
    simpleValue?: SimpleTypeDef;
    /** Effective content model (base content followed by own content for extensions). */
    particle?: Particle;
    /** Content declared by this derivation step only. */
    ownParticle?: Particle;
    /** Effective attribute uses, prohibited ones removed. */
    attributes: AttributeUse[];
    /** Attribute uses declared by this derivation step only. */
    ownAttributes: AttributeUse[];
    attributeWildcard?: Wildcard;
    openContent?: OpenContent;
    block: DerivationMethod[];
    final: DerivationMethod[];
    assertions: string[];
}

export type TypeDef = SimpleTypeDef | ComplexTypeDef;

// -- the whole schema ---------------------------------------------------------

export interface NamedGroup extends Component {
    name: QName;
    group: ModelGroup;
}

export interface NamedAttributeGroup extends Component {
    name: QName;
    attributes: AttributeUse[];
    wildcard?: Wildcard;
}

export interface CompiledSchema {
    /** Global element declarations, in document order. */
    elements: Map<string, ElementDecl>;
    attributes: Map<string, AttributeDecl>;
    /** Global named simple and complex types (without the built-ins). */
    types: Map<string, TypeDef>;
    groups: Map<string, NamedGroup>;
    attributeGroups: Map<string, NamedAttributeGroup>;
    notations: Map<string, RawNotation>;
    targetNamespaces: string[];
    /** Locations of every document that was loaded. */
    documents: string[];
    diagnostics: Diagnostic[];
    anyType: ComplexTypeDef;
    anySimpleType: SimpleTypeDef;
    /** Look up (and lazily create) a built-in datatype by local name. */
    builtin(local: string): SimpleTypeDef | undefined;
}

// -- helpers ------------------------------------------------------------------

export const isElementTerm = (t: Particle['term']): t is ElementDecl =>
    t.kind === 'element';

export const isWildcardTerm = (t: Particle['term']): t is Wildcard =>
    t.kind === 'any';

export const isModelGroupTerm = (t: Particle['term']): t is ModelGroup =>
    t.kind === 'sequence' || t.kind === 'choice' || t.kind === 'all';

/** Does a wildcard allow elements/attributes of the given namespace? */
export const wildcardAllows = (w: Wildcard, ns: string): boolean => {
    const c = w.namespace;
    switch (c.kind) {
        case 'any':
            return true;
        case 'other':
            return ns !== '' && ns !== c.ns;
        case 'list':
            return c.namespaces.includes(ns);
        case 'not':
            return !c.namespaces.includes(ns);
    }
};

/** Effective whitespace normalization for a simple type. */
export const whiteSpaceOf = (t: SimpleTypeDef): WhiteSpace =>
    t.facets.whiteSpace ?? t.base?.facets.whiteSpace ?? 'preserve';
