import { QName } from '../names';
import { FacetName } from '../datatypes/builtins';

/**
 * "Raw" components: what a schema document says, one-to-one with its XSD
 * elements, with attribute defaults applied and QNames resolved to namespace
 * URIs, but with references still unresolved. The compiler turns these into
 * the resolved model in `../model`.
 */

export interface Occurs {
    min: number;
    /** `Infinity` stands for `unbounded`. */
    max: number;
}

export interface Documentation {
    lang?: string;
    text: string;
}

export interface Annotation {
    documentation: Documentation[];
    appinfo: string[];
}

export type DerivationMethod =
    | 'extension'
    | 'restriction'
    | 'substitution'
    | 'list'
    | 'union';

export interface RawBase {
    /** Location of the node in its document, for diagnostics. */
    path: string;
    /** Schema document the node came from. */
    file: string;
    annotation?: Annotation;
}

export type FormChoice = 'qualified' | 'unqualified';

// -- identity constraints -----------------------------------------------------

export interface RawIdentityConstraint extends RawBase {
    kind: 'unique' | 'key' | 'keyref';
    name: string;
    refer?: QName;
    selector: string;
    fields: string[];
}

// -- wildcards ----------------------------------------------------------------

export interface RawWildcard extends RawBase {
    kind: 'any' | 'anyAttribute';
    /** Raw `namespace` attribute: `##any`, `##other` or a list of URIs/`##local`/`##targetNamespace`. */
    namespace: string;
    notNamespace?: string;
    notQName?: string;
    processContents: 'strict' | 'lax' | 'skip';
    occurs: Occurs;
    /** Namespace of the declaring document, needed to expand `##other`/`##targetNamespace`. */
    targetNamespace: string;
}

// -- declarations -------------------------------------------------------------

export interface RawAlternative extends RawBase {
    test?: string;
    type?: QName;
    inlineType?: RawType;
}

export interface RawElement extends RawBase {
    kind: 'element';
    name?: string;
    ref?: QName;
    type?: QName;
    inlineType?: RawType;
    occurs: Occurs;
    nillable: boolean;
    default?: string;
    fixed?: string;
    abstract: boolean;
    substitutionGroup: QName[];
    form?: FormChoice;
    block: DerivationMethod[];
    final: DerivationMethod[];
    identity: RawIdentityConstraint[];
    alternatives: RawAlternative[];
    global: boolean;
    /** XSD 1.1 `targetNamespace` on local declarations. */
    targetNamespace?: string;
}

export interface RawAttribute extends RawBase {
    kind: 'attribute';
    name?: string;
    ref?: QName;
    type?: QName;
    inlineType?: RawSimpleType;
    use: 'optional' | 'required' | 'prohibited';
    default?: string;
    fixed?: string;
    form?: FormChoice;
    inheritable: boolean;
    global: boolean;
    targetNamespace?: string;
}

export interface RawAttributeGroup extends RawBase {
    kind: 'attributeGroup';
    /** Present for definitions. */
    name?: string;
    /** Present for references. */
    ref?: QName;
    attributes: Array<RawAttribute | RawAttributeGroup>;
    anyAttribute?: RawWildcard;
}

export interface RawNotation extends RawBase {
    kind: 'notation';
    name: string;
    public?: string;
    system?: string;
}

// -- particles ----------------------------------------------------------------

export interface RawModelGroup extends RawBase {
    kind: 'sequence' | 'choice' | 'all';
    occurs: Occurs;
    particles: RawParticle[];
}

export interface RawGroup extends RawBase {
    kind: 'group';
    name?: string;
    ref?: QName;
    occurs: Occurs;
    /** Present for definitions. */
    model?: RawModelGroup;
}

export type RawParticle = RawElement | RawModelGroup | RawGroup | RawWildcard;

// -- simple types -------------------------------------------------------------

export interface RawFacet extends RawBase {
    name: FacetName;
    value: string;
    fixed: boolean;
    /** `assertion` facets carry an XPath test instead of a value. */
    test?: string;
}

export interface RawSimpleRestriction extends RawBase {
    kind: 'restriction';
    base?: QName;
    inline?: RawSimpleType;
    facets: RawFacet[];
}

export interface RawList extends RawBase {
    kind: 'list';
    itemType?: QName;
    inline?: RawSimpleType;
}

export interface RawUnion extends RawBase {
    kind: 'union';
    memberTypes: QName[];
    inline: RawSimpleType[];
}

export interface RawSimpleType extends RawBase {
    kind: 'simpleType';
    name?: string;
    final: DerivationMethod[];
    derivation: RawSimpleRestriction | RawList | RawUnion;
}

// -- complex types ------------------------------------------------------------

export interface RawOpenContent extends RawBase {
    kind: 'openContent';
    mode: 'interleave' | 'suffix' | 'none';
    wildcard?: RawWildcard;
}

export interface RawAttributeContent {
    /** Filled in by the rule engine, like `RawBase`. */
    path?: string;
    file?: string;
    attributes: Array<RawAttribute | RawAttributeGroup>;
    anyAttribute?: RawWildcard;
}

export interface RawShorthandContent extends RawAttributeContent {
    form: 'shorthand';
    particle?: RawParticle;
}

export interface RawComplexDerivation extends RawAttributeContent {
    form: 'complex';
    derivation: 'extension' | 'restriction';
    base: QName;
    mixed?: boolean;
    particle?: RawParticle;
    openContent?: RawOpenContent;
}

export interface RawSimpleDerivation extends RawAttributeContent {
    form: 'simple';
    derivation: 'extension' | 'restriction';
    base: QName;
    inlineSimple?: RawSimpleType;
    facets: RawFacet[];
}

export interface RawComplexType extends RawBase {
    kind: 'complexType';
    name?: string;
    abstract: boolean;
    mixed?: boolean;
    block: DerivationMethod[];
    final: DerivationMethod[];
    content: RawShorthandContent | RawComplexDerivation | RawSimpleDerivation;
    openContent?: RawOpenContent;
    assertions: string[];
}

export type RawType = RawSimpleType | RawComplexType;

// -- schema level ---------------------------------------------------------------

export interface RawInclude extends RawBase {
    kind: 'include';
    schemaLocation: string;
}

export interface RawImport extends RawBase {
    kind: 'import';
    namespace?: string;
    schemaLocation?: string;
}

export type RawGlobalComponent =
    | RawSimpleType
    | RawComplexType
    | RawGroup
    | RawAttributeGroup
    | RawElement
    | RawAttribute
    | RawNotation;

export interface RawRedefine extends RawBase {
    kind: 'redefine';
    schemaLocation: string;
    components: RawGlobalComponent[];
}

export interface RawOverride extends RawBase {
    kind: 'override';
    schemaLocation: string;
    components: RawGlobalComponent[];
}

export interface RawSchema extends RawBase {
    kind: 'schema';
    /** Declared `targetNamespace` of the document (`''` when absent). */
    targetNamespace: string;
    hasTargetNamespace: boolean;
    elementFormDefault: FormChoice;
    attributeFormDefault: FormChoice;
    blockDefault: DerivationMethod[];
    finalDefault: DerivationMethod[];
    version?: string;
    defaultOpenContent?: RawOpenContent & { appliesToEmpty: boolean };
    includes: RawInclude[];
    imports: RawImport[];
    redefines: RawRedefine[];
    overrides: RawOverride[];
    simpleTypes: RawSimpleType[];
    complexTypes: RawComplexType[];
    groups: RawGroup[];
    attributeGroups: RawAttributeGroup[];
    elements: RawElement[];
    attributes: RawAttribute[];
    notations: RawNotation[];
}
