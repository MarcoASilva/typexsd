import { QName, qkey } from '../names';
import {
    AttributeUse,
    CompiledSchema,
    ComplexTypeDef,
    ElementDecl,
    Particle,
    SimpleTypeDef,
    TypeDef,
    Wildcard,
    isElementTerm,
    isWildcardTerm,
} from '../model';

/**
 * The flat view of a complex type: the shape used by generated TypeScript
 * types, the builder and the parser.
 *
 * Under the flat convention attributes and child elements are sibling
 * properties of one object and the element's text lives under a property named
 * after the element. This module evaluates the content model into that shape:
 *
 * - effective cardinality: an element is optional when any enclosing particle
 *   has `minOccurs=0` and is an array when any enclosing particle (or its own)
 *   has `maxOccurs>1`;
 * - a `choice` (that cannot repeat) becomes a union of its branches; several
 *   choices combine as an intersection of unions instead of expanding every
 *   permutation; a repeating `choice` makes all of its elements optional arrays;
 * - substitution groups expand to one alternative per concrete member;
 * - key collisions between attributes and elements are resolved
 *   deterministically and reported through `collisions`.
 */

export interface Slot {
    /** Property name in the flat object. */
    key: string;
    decl: ElementDecl;
    optional: boolean;
    array: boolean;
    /** Effective occurrence bounds: the product of every enclosing particle. */
    min: number;
    max: number;
}

export interface ChoiceGroup {
    branches: ContentShape[];
    /** The whole group may be absent (adds an empty alternative). */
    optional: boolean;
}

export interface ContentShape {
    slots: Slot[];
    choices: ChoiceGroup[];
    /** Element wildcard (`xs:any`) found in the content model. */
    wildcard?: Wildcard;
}

export interface AttrMember {
    key: string;
    use: AttributeUse;
    type: SimpleTypeDef;
    required: boolean;
    fixed?: string;
    default?: string;
}

export interface ContentView {
    type: ComplexTypeDef;
    attributes: AttrMember[];
    shape: ContentShape;
    /** Wildcard for child elements (content model `xs:any` or open content). */
    elementWildcard?: Wildcard;
    attributeWildcard?: Wildcard;
    /** Element text is part of the value (simple or mixed content). */
    hasText: boolean;
    /** Value type of the element text (simple content: its type, mixed: string). */
    textType?: SimpleTypeDef;
    /**
     * Whether values of this type are objects. `false` for simple content
     * without attributes, where the value is just the (typed) text.
     */
    objectForm: boolean;
    /** Child element lookup by qualified name, aggregated over all branches. */
    index: Map<string, Slot>;
    /** Every property name already used by attributes and elements. */
    keys: Set<string>;
    collisions: string[];
}

// -----------------------------------------------------------------------------
// key allocation
// -----------------------------------------------------------------------------

class KeyAllocator {
    readonly taken = new Set<string>();
    private elementKeys = new Map<string, string>();
    readonly collisions: string[] = [];

    element(name: QName): string {
        const id = qkey(name);
        const known = this.elementKeys.get(id);
        if (known) return known;
        let key = name.local;
        let n = 2;
        while (this.taken.has(key)) key = `${name.local}_${n++}`;
        if (key !== name.local)
            this.collisions.push(
                `elements ${id} and another element share the name "${name.local}"; using "${key}"`,
            );
        this.taken.add(key);
        this.elementKeys.set(id, key);
        return key;
    }

    attribute(name: QName): string {
        let key = name.local;
        if (this.taken.has(key)) {
            this.collisions.push(
                `attribute "${name.local}" collides with an element of the same name; using "${name.local}_attribute"`,
            );
            key = `${name.local}_attribute`;
            let n = 2;
            while (this.taken.has(key)) key = `${name.local}_attribute${n++}`;
        }
        this.taken.add(key);
        return key;
    }
}

// -----------------------------------------------------------------------------
// shape evaluation
// -----------------------------------------------------------------------------

const emptyShape = (): ContentShape => ({ slots: [], choices: [] });

const merge = (shapes: ContentShape[]): ContentShape => {
    const result = emptyShape();
    const bySlot = new Map<string, Slot>();
    for (const shape of shapes) {
        for (const slot of shape.slots) {
            const existing = bySlot.get(slot.key);
            if (existing) {
                // the same element twice in one sequence: it can repeat
                existing.array = true;
                existing.optional = existing.optional && slot.optional;
                existing.min += slot.min;
                existing.max += slot.max;
            } else {
                const copy = { ...slot };
                bySlot.set(slot.key, copy);
                result.slots.push(copy);
            }
        }
        result.choices.push(...shape.choices);
        if (!result.wildcard && shape.wildcard)
            result.wildcard = shape.wildcard;
    }
    return result;
};

interface Inherited {
    optional: boolean;
    repeated: boolean;
    min: number;
    max: number;
}

const elementShape = (
    decl: ElementDecl,
    p: Particle,
    inherited: Inherited,
    keys: KeyAllocator,
): ContentShape => {
    const repeated = inherited.repeated || p.max > 1;
    const optional = inherited.optional || p.min === 0;

    const candidates: ElementDecl[] = [];
    if (!decl.abstract) candidates.push(decl);
    for (const sub of decl.substitutes)
        if (!sub.abstract && !candidates.includes(sub)) candidates.push(sub);

    if (candidates.length === 0) return emptyShape();

    const min = inherited.min * p.min;
    const max = inherited.max * p.max;
    const slotFor = (d: ElementDecl, isOptional: boolean): Slot => ({
        key: keys.element(d.name),
        decl: d,
        optional: isOptional,
        array: repeated,
        min: isOptional ? 0 : min,
        max,
    });

    if (candidates.length === 1)
        return { slots: [slotFor(candidates[0], optional)], choices: [] };

    // substitution group: exactly one of the members per occurrence
    if (repeated)
        return {
            slots: candidates.map(c => slotFor(c, true)),
            choices: [],
        };
    return {
        slots: [],
        choices: [
            {
                optional,
                branches: candidates.map(c => ({
                    slots: [slotFor(c, false)],
                    choices: [],
                })),
            },
        ],
    };
};

const shapeOf = (
    p: Particle,
    inherited: Inherited,
    keys: KeyAllocator,
): ContentShape => {
    const term = p.term;
    if (isElementTerm(term)) return elementShape(term, p, inherited, keys);
    if (isWildcardTerm(term)) return { slots: [], choices: [], wildcard: term };

    const repeated = inherited.repeated || p.max > 1;
    const ownOptional = p.min === 0;

    if (term.kind === 'choice' && term.particles.length > 1) {
        if (repeated) {
            // any combination and order may occur: everything is an optional array
            return merge(
                term.particles.map(c =>
                    shapeOf(
                        c,
                        {
                            optional: true,
                            repeated: true,
                            min: 0,
                            max: inherited.max * p.max,
                        },
                        keys,
                    ),
                ),
            );
        }
        const branches = term.particles.map(c =>
            shapeOf(
                c,
                {
                    optional: inherited.optional,
                    repeated: false,
                    min: inherited.min,
                    max: inherited.max,
                },
                keys,
            ),
        );
        const wildcard = branches.find(b => b.wildcard)?.wildcard;
        return {
            slots: [],
            choices: [
                {
                    branches,
                    optional: ownOptional && !inherited.optional,
                },
            ],
            wildcard,
        };
    }

    // sequence, all, and degenerate choices
    const childInherited: Inherited = {
        optional: inherited.optional || ownOptional,
        repeated,
        min: inherited.min * p.min,
        max: inherited.max * p.max,
    };
    return merge(term.particles.map(c => shapeOf(c, childInherited, keys)));
};

const collectIndex = (shape: ContentShape, index: Map<string, Slot>): void => {
    for (const slot of shape.slots) {
        const id = qkey(slot.decl.name);
        const existing = index.get(id);
        if (existing) {
            existing.array = existing.array || slot.array;
            existing.optional = existing.optional && slot.optional;
            existing.max = Math.max(existing.max, slot.max);
            existing.min = Math.min(existing.min, slot.min);
        } else {
            index.set(id, { ...slot });
        }
    }
    for (const group of shape.choices)
        for (const branch of group.branches) collectIndex(branch, index);
};

// -----------------------------------------------------------------------------
// view
// -----------------------------------------------------------------------------

const cache = new WeakMap<ComplexTypeDef, ContentView>();

export const getContentView = (type: ComplexTypeDef): ContentView => {
    const cached = cache.get(type);
    if (cached) return cached;

    const keys = new KeyAllocator();
    const shape = type.particle
        ? shapeOf(
              type.particle,
              { optional: false, repeated: false, min: 1, max: 1 },
              keys,
          )
        : emptyShape();

    const attributes: AttrMember[] = type.attributes
        .filter(u => u.use !== 'prohibited')
        .map(use => ({
            key: keys.attribute(use.decl.name),
            use,
            type: use.decl.type,
            required: use.use === 'required',
            fixed: use.fixed ?? use.decl.fixed,
            default: use.default ?? use.decl.default,
        }));

    const hasText =
        type.contentKind === 'simple' || type.contentKind === 'mixed';
    const elementWildcard = shape.wildcard ?? type.openContent?.wildcard;
    const hasAttributes = attributes.length > 0 || !!type.attributeWildcard;
    const hasElements =
        shape.slots.length > 0 || shape.choices.length > 0 || !!elementWildcard;

    let objectForm: boolean;
    switch (type.contentKind) {
        case 'simple':
            objectForm = hasAttributes;
            break;
        case 'mixed':
            objectForm = hasAttributes || hasElements;
            break;
        default:
            objectForm = true;
    }

    const index = new Map<string, Slot>();
    collectIndex(shape, index);

    const view: ContentView = {
        type,
        attributes,
        shape,
        elementWildcard,
        attributeWildcard: type.attributeWildcard,
        hasText,
        textType: type.contentKind === 'simple' ? type.simpleValue : undefined,
        objectForm,
        index,
        keys: keys.taken,
        collisions: keys.collisions,
    };
    cache.set(type, view);
    return view;
};

/**
 * Name of the property holding an element's text under the flat convention:
 * the element's own name, made unique when an attribute or child already
 * uses it.
 */
export const textKey = (view: ContentView, elementName: string): string => {
    if (!view.keys.has(elementName)) return elementName;
    let key = `${elementName}_text`;
    let n = 2;
    while (view.keys.has(key)) key = `${elementName}_text${n++}`;
    return key;
};

/** Whether the flat key `key` of `view` is reported to collide with the text key. */
export const textKeyCollides = (
    view: ContentView,
    elementName: string,
): boolean => view.keys.has(elementName);

export const isAnyType = (type: TypeDef): boolean =>
    type.kind === 'complex' && type.derivation === 'none';

export const slotCount = (shape: ContentShape): number =>
    shape.slots.length +
    shape.choices.reduce(
        (n, g) => n + g.branches.reduce((m, b) => m + slotCount(b), 0),
        0,
    );

/**
 * Property names for the global elements, as used by the root `Schema` type
 * and by the builder/parser to find an element by name. Abstract elements
 * cannot appear in a document and are left out.
 */
export const globalElementKeys = (
    elements: Iterable<ElementDecl>,
): Map<string, ElementDecl> => {
    const keys = new Map<string, ElementDecl>();
    for (const decl of elements) {
        if (decl.abstract) continue;
        let key = decl.name.local;
        let n = 2;
        while (keys.has(key)) key = `${decl.name.local}_${n++}`;
        keys.set(key, decl);
    }
    return keys;
};

export interface TypeUsage {
    /** Local names of the elements declared with each complex type. */
    users: Map<ComplexTypeDef, Set<string>>;
    /** Complex types that another type extends. */
    extended: Set<ComplexTypeDef>;
}

/**
 * Which element names use which complex type, so that generated types can
 * fold an element's text value into the type when only one element name uses
 * it (the text property is named after the element).
 */
export const collectTypeUsage = (schema: CompiledSchema): TypeUsage => {
    const users = new Map<ComplexTypeDef, Set<string>>();
    const extended = new Set<ComplexTypeDef>();
    const seenTypes = new Set<TypeDef>();
    const seenDecls = new Set<ElementDecl>();

    const visitParticle = (p: Particle | undefined): void => {
        if (!p) return;
        const term = p.term;
        if (isElementTerm(term)) visitDecl(term);
        else if (!isWildcardTerm(term)) term.particles.forEach(visitParticle);
    };

    const visitType = (t: TypeDef): void => {
        if (seenTypes.has(t) || t.kind !== 'complex') return;
        seenTypes.add(t);
        if (t.derivation === 'extension' && t.base.kind === 'complex')
            extended.add(t.base);
        if (t.base && t.base !== t) visitType(t.base);
        visitParticle(t.particle);
    };

    const visitDecl = (decl: ElementDecl): void => {
        if (decl.type.kind === 'complex') {
            let names = users.get(decl.type);
            if (!names) users.set(decl.type, (names = new Set()));
            names.add(decl.name.local);
        }
        if (seenDecls.has(decl)) return;
        seenDecls.add(decl);
        visitType(decl.type);
        for (const alt of decl.alternatives) visitType(alt.type);
    };

    for (const decl of schema.elements.values()) visitDecl(decl);
    for (const type of schema.types.values()) visitType(type);
    return { users, extended };
};
