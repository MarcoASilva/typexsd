import { SchemaOptions } from '../schema';
import {
    CompiledSchema,
    ElementDecl,
    Particle,
    isElementTerm,
    isWildcardTerm,
} from '../xsd/model';
import { QName, XML_NS, XSI_NS, qkey } from '../xsd/names';
import { ContentView, getContentView, isAnyType, textKey } from '../xsd/view';
import { formatSimple } from './values';
import { XmlOut, serialize } from './xml-writer';
import {
    SchemaSource,
    findGlobalElement,
    isRecord,
    resolveSchema,
} from './common';

export interface BuilderOptions extends SchemaOptions {
    /** Indent the output (default `true`). */
    pretty?: boolean;
    /** Emit the `<?xml ... ?>` declaration (default `true`). */
    declaration?: boolean;
}

export type Builder = <T extends keyof U, U>(data: U, elementName: T) => string;

type Scalar = string | number | boolean | bigint | Date | Uint8Array;

const isScalar = (value: unknown): value is Scalar =>
    ['string', 'number', 'boolean', 'bigint'].includes(typeof value) ||
    value instanceof Date ||
    value instanceof Uint8Array;

interface Scope {
    /** The default namespace in effect at this point of the output. */
    defaultNs: string;
}

/**
 * Serializes data to XML following the compiled schema: child elements come
 * out in schema order, arrays repeat their element, attributes and values are
 * formatted through their datatype's codec, and namespaces are declared as
 * needed.
 */
class XmlWriter {
    constructor(
        private readonly schema: CompiledSchema,
        private readonly options: BuilderOptions,
    ) {}

    build(data: unknown, elementName: string): string {
        const decl = findGlobalElement(this.schema, elementName);
        if (!decl) {
            const available = [...this.schema.elements.values()]
                .map(d => d.name.local)
                .slice(0, 10)
                .join(', ');
            throw new Error(
                `Cannot build XML: element "${elementName}" is not declared in the schema (declared: ${available}${
                    this.schema.elements.size > 10 ? ', ...' : ''
                })`,
            );
        }
        const value = isRecord(data)
            ? (data as Record<string, unknown>)[elementName]
            : undefined;
        if (value === undefined)
            throw new Error(
                `Cannot build XML: data has no "${elementName}" property`,
            );

        const root = new XmlOut(decl.name.local);
        const scope: Scope = { defaultNs: '' };
        this.declareDefaultNamespace(root, decl.name.ns, scope);
        this.fill(root, decl, value, scope);
        return serialize(root, {
            pretty: this.options.pretty ?? true,
            declaration: this.options.declaration ?? true,
        });
    }

    // -- names and namespaces -------------------------------------------------

    private declareDefaultNamespace(
        el: XmlOut,
        ns: string,
        scope: Scope,
    ): void {
        if (ns !== scope.defaultNs) {
            el.att('xmlns', ns);
            scope.defaultNs = ns;
        }
    }

    /** Prefixes declared for namespaced attributes, per element. */
    private readonly attributePrefixes = new WeakMap<
        XmlOut,
        Map<string, string>
    >();

    private attributeName(el: XmlOut, name: QName): string {
        if (!name.ns) return name.local;
        if (name.ns === XML_NS) return `xml:${name.local}`;
        let prefixes = this.attributePrefixes.get(el);
        if (!prefixes) this.attributePrefixes.set(el, (prefixes = new Map()));
        let prefix = prefixes.get(name.ns);
        if (!prefix) {
            prefix = `ns${prefixes.size + 1}`;
            prefixes.set(name.ns, prefix);
            el.att(`xmlns:${prefix}`, name.ns);
        }
        return `${prefix}:${name.local}`;
    }

    // -- elements -----------------------------------------------------------------

    private emitValue(
        parent: XmlOut,
        decl: ElementDecl,
        value: unknown,
        parentScope: Scope,
    ): void {
        if (value === undefined) return;
        if (value === null && !decl.nillable) return;

        const scope: Scope = { defaultNs: parentScope.defaultNs };
        const el = parent.ele(decl.name.local);
        this.declareDefaultNamespace(el, decl.name.ns, scope);
        this.fill(el, decl, value, scope);
    }

    private fill(
        el: XmlOut,
        decl: ElementDecl,
        value: unknown,
        scope: Scope,
    ): void {
        if (value === null) {
            el.att('xmlns:xsi', XSI_NS);
            el.att('xsi:nil', 'true');
            return;
        }

        const type = decl.type;
        if (isAnyType(type)) {
            this.fillGeneric(el, value);
            return;
        }
        if (type.kind === 'simple') {
            el.text(formatSimple(type, value));
            return;
        }

        const view = getContentView(type);
        if (!view.objectForm) {
            const text = formatSimple(
                view.textType ?? this.schema.anySimpleType,
                isRecord(value) ? '' : value,
            );
            if (text !== '') el.text(text);
            return;
        }

        const key = textKey(view, decl.name.local);
        let obj: Record<string, unknown>;
        if (isRecord(value)) obj = value;
        else if (isScalar(value) && view.hasText) obj = { [key]: value };
        else
            throw new Error(
                `Cannot build element "${
                    decl.name.local
                }": expected an object but got ${typeof value}`,
            );

        const used = new Set<string>();

        // attributes
        for (const member of view.attributes) {
            used.add(member.key);
            const v = obj[member.key];
            if (v === undefined || v === null) continue;
            el.att(
                this.attributeName(el, member.use.decl.name),
                formatSimple(member.type, v),
            );
        }

        // text
        used.add(key);
        if (view.hasText && obj[key] !== undefined && obj[key] !== null) {
            const text = formatSimple(
                view.textType ?? this.schema.builtin('string')!,
                obj[key],
            );
            if (text !== '') el.text(text);
        }

        // child elements, in content model order
        if (type.particle)
            this.emitParticle(type.particle, view, obj, used, el, scope);

        // wildcard content
        this.emitLeftovers(el, view, obj, used);
    }

    private emitParticle(
        particle: Particle,
        view: ContentView,
        obj: Record<string, unknown>,
        used: Set<string>,
        el: XmlOut,
        scope: Scope,
    ): void {
        const term = particle.term;
        if (isWildcardTerm(term)) return;

        if (isElementTerm(term)) {
            const candidates = [term, ...term.substitutes].filter(
                (c, i, all) => !c.abstract && all.indexOf(c) === i,
            );
            for (const candidate of candidates) {
                const slot = view.index.get(qkey(candidate.name));
                if (!slot || used.has(slot.key)) continue;
                used.add(slot.key);
                const v = obj[slot.key];
                // an array repeats the element, unless the element's own value is a list
                if (
                    Array.isArray(v) &&
                    (slot.array || !this.isListValued(candidate))
                )
                    for (const item of v)
                        this.emitValue(el, candidate, item, scope);
                else this.emitValue(el, candidate, v, scope);
            }
            return;
        }

        // sequence, all and choice: emit every branch that has data, in order.
        // A choice with data in several branches is emitted as-is so that a
        // schema validator, not the builder, reports the problem.
        for (const child of term.particles)
            this.emitParticle(child, view, obj, used, el, scope);
    }

    private isListValued(decl: ElementDecl): boolean {
        const type = decl.type;
        if (type.kind === 'simple') return type.variety === 'list';
        if (isAnyType(type)) return false;
        return getContentView(type).textType?.variety === 'list';
    }

    private emitLeftovers(
        el: XmlOut,
        view: ContentView,
        obj: Record<string, unknown>,
        used: Set<string>,
    ): void {
        const extra = Object.entries(obj).filter(
            ([k, v]) => !used.has(k) && !view.keys.has(k) && v !== undefined,
        );
        if (!extra.length) return;

        for (const [k, v] of extra) {
            if (view.elementWildcard) {
                this.emitGenericEntry(el, k, v);
            } else if (view.attributeWildcard && isScalar(v)) {
                el.att(k, formatSimple(this.schema.anySimpleType, v));
            }
        }
    }

    // -- content the schema does not describe (xs:any, anyType) -------------------

    private fillGeneric(el: XmlOut, value: unknown): void {
        if (isScalar(value)) {
            const text = formatSimple(this.schema.anySimpleType, value);
            if (text !== '') el.text(text);
            return;
        }
        if (!isRecord(value)) return;
        for (const [k, v] of Object.entries(value))
            this.emitGenericEntry(el, k, v);
    }

    /** `@name` entries are attributes, `#text` is text, everything else a child element. */
    private emitGenericEntry(el: XmlOut, key: string, value: unknown): void {
        if (value === undefined || value === null) return;
        if (key.startsWith('@')) {
            el.att(
                key.slice(1),
                formatSimple(this.schema.anySimpleType, value),
            );
            return;
        }
        if (key === '#text') {
            const text = formatSimple(this.schema.anySimpleType, value);
            if (text !== '') el.text(text);
            return;
        }
        for (const item of Array.isArray(value) ? value : [value]) {
            const child = el.ele(key);
            this.fillGeneric(child, item);
        }
    }
}

/** Create a function that builds XML for a global element of the schema. */
export const createBuilder = (
    schema: SchemaSource,
    options: BuilderOptions = {},
): Builder => {
    const compiled = resolveSchema(schema, options);
    const writer = new XmlWriter(compiled, options);
    return ((data: unknown, elementName: string) =>
        writer.build(data, elementName)) as Builder;
};

export interface Target {
    xsdFilePath?: string;
    schema?: CompiledSchema;
}

/** One-shot variant of `createBuilder`. */
export const build = <T extends keyof U, U>(
    { xsdFilePath, schema }: Target,
    data: U,
    elementName: T,
    options: BuilderOptions = {},
): string => {
    const source = schema ?? xsdFilePath;
    if (!source)
        throw new Error(
            'Cannot build XML. Neither "schema" nor "xsdFilePath" was provided.',
        );
    return createBuilder(source, options)(data, elementName);
};
