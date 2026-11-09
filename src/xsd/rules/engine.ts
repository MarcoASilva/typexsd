import { XmlElement } from '../dom';
import { DiagnosticBag, Severity } from '../diagnostics';
import { QName, XSD_NS, isNCName } from '../names';
import { DerivationMethod, Occurs } from './raw';

/**
 * Declarative rule engine.
 *
 * Every XSD element is described by a `RuleDef`: the attributes it accepts
 * (with value parsers and defaults), the children it accepts and in which
 * order, cross-attribute constraints, and a `build()` that turns the parsed
 * pieces into a raw component. The engine owns all the generic work (prefix
 * independence, defaults, content order checking, diagnostics) so rules only
 * express what is specific to their element.
 */

export class AttrError extends Error {}

// -----------------------------------------------------------------------------
// build context
// -----------------------------------------------------------------------------

export class BuildContext {
    /** Effective target namespace of the document being built. */
    targetNamespace = '';

    constructor(
        public readonly file: string,
        public readonly diagnostics: DiagnosticBag,
        /** Set when the document is a chameleon include adopting this namespace. */
        public readonly chameleonNs?: string,
    ) {}

    report(
        severity: Severity,
        node: XmlElement,
        code: string,
        message: string,
    ): void {
        this.diagnostics.add({
            severity,
            code,
            message,
            path: node.path,
            file: node.line ? `${this.file}:${node.line}` : this.file,
        });
    }

    resolveQName(node: XmlElement, lexical: string): QName {
        const q = node.resolveQName(lexical, true);
        if (!q) throw new AttrError(`unbound namespace prefix in "${lexical}"`);
        if (q.ns === '' && this.chameleonNs) q.ns = this.chameleonNs;
        return q;
    }
}

// -----------------------------------------------------------------------------
// attribute specs
// -----------------------------------------------------------------------------

export interface AttrSpec<T = any> {
    parse(value: string, node: XmlElement, ctx: BuildContext): T;
    default?: T;
    required?: boolean;
}

const spec = <T>(
    parse: AttrSpec<T>['parse'],
    options: { default?: T; required?: boolean } = {},
): AttrSpec<T> => ({ parse, ...options });

type Opts<T> = { default?: T; required?: boolean };

export const str = (o: Opts<string> = {}) => spec(v => v, o);
export const token = (o: Opts<string> = {}) => spec(v => v.trim(), o);
export const uri = (o: Opts<string> = {}) => spec(v => v.trim(), o);

export const ncName = (o: Opts<string> = {}) =>
    spec(v => {
        const value = v.trim();
        if (!isNCName(value))
            throw new AttrError(`"${value}" is not a valid NCName`);
        return value;
    }, o);

export const qname = (o: Opts<QName> = {}) =>
    spec((v, node, ctx) => ctx.resolveQName(node, v), o);

export const qnameList = (o: Opts<QName[]> = { default: [] }) =>
    spec(
        (v, node, ctx) =>
            v
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map(item => ctx.resolveQName(node, item)),
        o,
    );

export const bool = (o: Opts<boolean> = {}) =>
    spec(v => {
        const value = v.trim();
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        throw new AttrError(`"${value}" is not a boolean`);
    }, o);

export const nonNegInt = (o: Opts<number> = {}) =>
    spec(v => {
        const value = v.trim();
        if (!/^\+?\d+$/.test(value))
            throw new AttrError(`"${value}" is not a non-negative integer`);
        return Number(value);
    }, o);

export const maxOccurs = (o: Opts<number> = {}) =>
    spec(v => {
        const value = v.trim();
        if (value === 'unbounded') return Infinity;
        if (!/^\+?\d+$/.test(value))
            throw new AttrError(
                `"${value}" is neither "unbounded" nor a non-negative integer`,
            );
        return Number(value);
    }, o);

export const oneOf = <T extends string>(
    values: readonly T[],
    o: Opts<T> = {},
) =>
    spec(v => {
        const value = v.trim() as T;
        if (!values.includes(value))
            throw new AttrError(
                `"${value}" is not one of ${values
                    .map(x => `"${x}"`)
                    .join(', ')}`,
            );
        return value;
    }, o);

const ALL_DERIVATIONS: DerivationMethod[] = [
    'extension',
    'restriction',
    'substitution',
    'list',
    'union',
];

export const derivationSet = (
    allowed: readonly DerivationMethod[] = ALL_DERIVATIONS,
    o: Opts<DerivationMethod[]> = {},
) =>
    spec(v => {
        const items = v.trim().split(/\s+/).filter(Boolean);
        if (items.includes('#all')) return [...allowed];
        for (const item of items)
            if (!allowed.includes(item as DerivationMethod))
                throw new AttrError(
                    `"${item}" is not a valid derivation method here`,
                );
        return items as DerivationMethod[];
    }, o);

// -----------------------------------------------------------------------------
// content model slots
// -----------------------------------------------------------------------------

export interface Slot {
    names: readonly string[];
    min: number;
    max: number;
}

export const one = (...names: string[]): Slot => ({ names, min: 1, max: 1 });
export const opt = (...names: string[]): Slot => ({ names, min: 0, max: 1 });
export const star = (...names: string[]): Slot => ({
    names,
    min: 0,
    max: Infinity,
});
export const plus = (...names: string[]): Slot => ({
    names,
    min: 1,
    max: Infinity,
});

const checkContent = (slots: Slot[], names: string[]): string[] => {
    const problems: string[] = [];
    const counts = slots.map(() => 0);
    let at = 0;
    for (const name of names) {
        let placed = false;
        for (let i = at; i < slots.length; i++) {
            if (slots[i].names.includes(name) && counts[i] < slots[i].max) {
                counts[i]++;
                at = i;
                placed = true;
                break;
            }
            if (counts[i] < slots[i].min) break;
        }
        if (!placed) {
            const earlier = slots.some(
                (s, i) => i < at && s.names.includes(name),
            );
            problems.push(
                earlier || slots.some(s => s.names.includes(name))
                    ? `<${name}> is out of order or occurs too often`
                    : `<${name}> is not allowed here`,
            );
        }
    }
    for (let i = at; i < slots.length; i++) {
        if (counts[i] < slots[i].min)
            problems.push(`missing required <${slots[i].names.join('|')}>`);
    }
    return problems;
};

// -----------------------------------------------------------------------------
// rule definition
// -----------------------------------------------------------------------------

export interface Kids {
    readonly all: ReadonlyArray<{ name: string; value: any; node: XmlElement }>;
    of<T = any>(...names: string[]): T[];
    first<T = any>(...names: string[]): T | undefined;
}

export interface RuleInput {
    node: XmlElement;
    /** Parsed attributes with defaults applied. */
    a: Record<string, any>;
    kids: Kids;
    /** Local name of the parent XSD element. */
    parent: string;
    /** Whether the parent is `schema`/`redefine`/`override` (a top-level declaration). */
    global: boolean;
    ctx: BuildContext;
}

export interface ConstraintInput {
    present: ReadonlySet<string>;
    node: XmlElement;
    kids: Kids;
    global: boolean;
    parent: string;
    a: Record<string, any>;
}

export interface Constraint {
    code: string;
    /** Defaults to `error`. */
    severity?: Severity;
    check(input: ConstraintInput): string | undefined;
}

export interface RuleDef<R = any> {
    name: string;
    attributes: Record<string, AttrSpec>;
    children: Slot[] | ((parent: string) => Slot[]);
    constraints?: Constraint[];
    /** Children are not XSD constructs (documentation/appinfo): do not walk them. */
    opaque?: boolean;
    /** Runs after attributes are parsed and before children are built. */
    prepare?(input: Pick<RuleInput, 'node' | 'a' | 'ctx' | 'parent'>): void;
    build(input: RuleInput): R;
}

const RULES = new Map<string, RuleDef>();

export const defineRule = <R>(def: RuleDef<R>): RuleDef<R> => {
    RULES.set(def.name, def);
    return def;
};

export const getRule = (name: string): RuleDef | undefined => RULES.get(name);

export const ruleNames = (): string[] => [...RULES.keys()];

// -----------------------------------------------------------------------------
// constraints
// -----------------------------------------------------------------------------

const list = (names: string[]) => names.map(n => `"${n}"`).join(', ');

/** Exactly one of the attributes must be present. */
export const xor = (...names: string[]): Constraint => ({
    code: 'attribute-xor',
    check: ({ present }) => {
        const found = names.filter(n => present.has(n));
        if (found.length === 1) return undefined;
        return found.length === 0
            ? `one of ${list(names)} is required`
            : `${list(found)} cannot be used together`;
    },
});

/** At most one of the attributes may be present. */
export const atMostOne = (...names: string[]): Constraint => ({
    code: 'attribute-exclusive',
    check: ({ present }) => {
        const found = names.filter(n => present.has(n));
        return found.length > 1
            ? `${list(found)} cannot be used together`
            : undefined;
    },
});

/** If `ref` is present, none of `others` may be (and no inline children listed in `kidNames`). */
export const forbidWith = (
    attr: string,
    others: string[],
    kidNames: string[] = [],
): Constraint => ({
    code: 'attribute-forbidden-with',
    check: ({ present, kids }) => {
        if (!present.has(attr)) return undefined;
        const bad = [
            ...others.filter(o => present.has(o)),
            ...kidNames.filter(k => kids.of(k).length > 0).map(k => `<${k}>`),
        ];
        return bad.length
            ? `"${attr}" cannot be combined with ${bad.join(', ')}`
            : undefined;
    },
});

export const globalOnly = (...attrs: string[]): Constraint => ({
    code: 'attribute-global-only',
    check: ({ present, global }) => {
        if (global) return undefined;
        const bad = attrs.filter(a => present.has(a));
        return bad.length
            ? `${list(bad)} is only allowed on top-level declarations`
            : undefined;
    },
});

export const localOnly = (...attrs: string[]): Constraint => ({
    code: 'attribute-local-only',
    check: ({ present, global }) => {
        if (!global) return undefined;
        const bad = attrs.filter(a => present.has(a));
        return bad.length
            ? `${list(bad)} is not allowed on top-level declarations`
            : undefined;
    },
});

export const custom = (
    code: string,
    check: Constraint['check'],
): Constraint => ({ code, check });

/** `minOccurs` cannot be greater than `maxOccurs`. */
export const occursConstraint: Constraint = {
    code: 'invalid-occurs',
    check: ({ a }) => {
        const { minOccurs, maxOccurs: max } = a;
        if (minOccurs === undefined || max === undefined) return undefined;
        if (minOccurs > max)
            return `minOccurs (${minOccurs}) cannot be greater than maxOccurs (${max})`;
        return undefined;
    },
};

export const occursOf = (a: Record<string, any>): Occurs => {
    const min = a.minOccurs ?? 1;
    const max = a.maxOccurs ?? 1;
    // be forgiving with min > max: keep the declaration usable
    return { min: Math.min(min, max), max };
};

// -----------------------------------------------------------------------------
// engine
// -----------------------------------------------------------------------------

const GLOBAL_PARENTS = new Set(['schema', 'redefine', 'override']);

const makeKids = (
    all: Array<{ name: string; value: any; node: XmlElement }>,
): Kids => ({
    all,
    of: <T>(...names: string[]) =>
        all.filter(k => names.includes(k.name)).map(k => k.value as T),
    first: <T>(...names: string[]) =>
        all.find(k => names.includes(k.name))?.value as T | undefined,
});

const slotsFor = (rule: RuleDef, parent: string): Slot[] =>
    typeof rule.children === 'function' ? rule.children(parent) : rule.children;

/**
 * Build the raw component for an XSD element. `parent` is the local name of the
 * enclosing XSD element (`schema` for the document root's children).
 */
export const buildNode = (
    node: XmlElement,
    parent: string,
    ctx: BuildContext,
): any => {
    if (node.ns !== XSD_NS) {
        ctx.report(
            'warning',
            node,
            'foreign-element',
            `element <${node.prefix ? node.prefix + ':' : ''}${
                node.local
            }> is not in the XML Schema namespace and was ignored`,
        );
        return undefined;
    }

    const rule = RULES.get(node.local);
    if (!rule) {
        ctx.report(
            'error',
            node,
            'unknown-element',
            `<${node.local}> is not a known XML Schema element`,
        );
        return undefined;
    }

    const global = GLOBAL_PARENTS.has(parent);

    // -- attributes -----------------------------------------------------------
    const a: Record<string, any> = {};
    const present = new Set<string>();
    for (const [name, s] of Object.entries(rule.attributes)) {
        const raw = node.attr(name);
        if (raw === undefined) {
            if (s.required)
                ctx.report(
                    'error',
                    node,
                    'missing-attribute',
                    `<${rule.name}> requires the "${name}" attribute`,
                );
            if (s.default !== undefined) a[name] = s.default;
            continue;
        }
        present.add(name);
        try {
            a[name] = s.parse(raw, node, ctx);
        } catch (error) {
            if (!(error instanceof AttrError)) throw error;
            ctx.report(
                'error',
                node,
                'invalid-attribute-value',
                `attribute "${name}" of <${rule.name}>: ${error.message}`,
            );
            if (s.default !== undefined) a[name] = s.default;
        }
    }
    for (const attr of node.attrs) {
        if (attr.ns === '' && !(attr.local in rule.attributes))
            ctx.report(
                'warning',
                node,
                'unknown-attribute',
                `attribute "${attr.local}" is not defined for <${rule.name}>`,
            );
    }

    rule.prepare?.({ node, a, ctx, parent });

    // -- children -------------------------------------------------------------
    const kidList: Array<{ name: string; value: any; node: XmlElement }> = [];
    if (!rule.opaque) {
        const slots = slotsFor(rule, parent);
        const allowed = new Set(slots.flatMap(s => [...s.names]));
        const xsdChildren = node.children.filter(c => c.ns === XSD_NS);

        for (const child of xsdChildren) {
            if (!RULES.has(child.local))
                ctx.report(
                    'error',
                    child,
                    'unknown-element',
                    `<${child.local}> is not a known XML Schema element`,
                );
        }

        for (const child of node.children) {
            if (child.ns !== XSD_NS) {
                ctx.report(
                    'warning',
                    child,
                    'foreign-element',
                    `element <${child.local}> is not in the XML Schema namespace and was ignored`,
                );
            }
        }

        const problems = checkContent(
            slots,
            xsdChildren.filter(c => RULES.has(c.local)).map(c => c.local),
        );
        for (const problem of problems)
            ctx.report(
                'error',
                node,
                'invalid-content',
                `in <${rule.name}>: ${problem}`,
            );

        for (const child of xsdChildren) {
            if (!allowed.has(child.local)) continue;
            const value = buildNode(child, rule.name, ctx);
            if (value !== undefined)
                kidList.push({ name: child.local, value, node: child });
        }
    }
    const kids = makeKids(kidList);

    // -- constraints ----------------------------------------------------------
    for (const constraint of rule.constraints ?? []) {
        const message = constraint.check({
            present,
            node,
            kids,
            global,
            parent,
            a,
        });
        if (message)
            ctx.report(
                constraint.severity ?? 'error',
                node,
                constraint.code,
                `<${rule.name}>: ${message}`,
            );
    }

    // -- build ----------------------------------------------------------------
    const result = rule.build({ node, a, kids, parent, global, ctx });
    if (result && typeof result === 'object') {
        if (result.path === undefined) result.path = node.path;
        if (result.file === undefined) result.file = ctx.file;
        const annotation = kids.first('annotation');
        if (
            annotation &&
            result.annotation === undefined &&
            rule.name !== 'annotation'
        )
            result.annotation = annotation;
    }
    return result;
};
