import { XmlElement, parseXml } from '../xsd/dom';
import { SchemaOptions } from '../schema';
import {
    CompiledSchema,
    ElementDecl,
    SimpleTypeDef,
    TypeDef,
    wildcardAllows,
} from '../xsd/model';
import { XSI_NS, qkey } from '../xsd/names';
import {
    ContentView,
    Slot,
    getContentView,
    isAnyType,
    textKey,
} from '../xsd/view';
import { coerceLoose, parseSimple } from './values';
import { SchemaSource, findGlobalElement, resolveSchema } from './common';

export interface ParserOptions extends SchemaOptions {
    /**
     * What to do with attributes and elements the schema does not describe:
     * keep them (loosely typed, the default), drop them, or throw.
     */
    unknown?: 'keep' | 'ignore' | 'error';
    /**
     * Return `Date` objects for `xs:dateTime` and `xs:date` values instead of
     * their lexical strings. Pair it with `typeMap: { dateTime: 'Date', date: 'Date' }`
     * when generating types.
     */
    dates?: boolean;
}

export type Parse<T = Record<string, any>> = (xml: string) => T;

// -----------------------------------------------------------------------------
// schema-less parsing
// -----------------------------------------------------------------------------

/**
 * Parse without a schema: attributes and child elements become sibling
 * properties, repeated elements become arrays, text is coerced to numbers and
 * booleans where it looks like one.
 */
const genericValue = (el: XmlElement): unknown => {
    const attrs = el.attrs.filter(a => a.ns !== XSI_NS);
    const children = el.children;
    const text = el.text;
    if (!attrs.length && !children.length) return coerceLoose(text.trim());

    const obj: Record<string, unknown> = {};
    for (const a of attrs) obj[a.local] = coerceLoose(a.value);
    for (const child of children) push(obj, child.local, genericValue(child));
    if (text.trim() !== '') obj[el.local] = coerceLoose(text.trim());
    return obj;
};

/** Set a property, turning it into an array when the name repeats. */
const push = (
    obj: Record<string, unknown>,
    key: string,
    value: unknown,
): void => {
    const existing = obj[key];
    if (existing === undefined) obj[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else obj[key] = [existing, value];
};

// -----------------------------------------------------------------------------
// schema-driven parsing
// -----------------------------------------------------------------------------

const byLocalName = new WeakMap<ContentView, Map<string, Slot>>();

/**
 * Find the slot of a child element: by qualified name first, then (leniently,
 * for documents that put every element in the schema's namespace although the
 * schema leaves local elements unqualified) by local name.
 */
const findSlot = (view: ContentView, child: XmlElement): Slot | undefined => {
    const exact = view.index.get(qkey({ ns: child.ns, local: child.local }));
    if (exact) return exact;
    let locals = byLocalName.get(view);
    if (!locals) {
        locals = new Map();
        for (const slot of view.index.values())
            if (!locals.has(slot.decl.name.local))
                locals.set(slot.decl.name.local, slot);
        byLocalName.set(view, locals);
    }
    return locals.get(child.local);
};

class SchemaParser {
    constructor(
        private readonly schema: CompiledSchema,
        private readonly options: ParserOptions,
    ) {}

    private value(type: SimpleTypeDef, lexical: string): unknown {
        return parseSimple(type, lexical, { dates: this.options.dates });
    }

    parseDocument(xml: string): unknown {
        const root = parseXml(xml);
        const decl =
            this.schema.elements.get(
                qkey({ ns: root.ns, local: root.local }),
            ) ?? findGlobalElement(this.schema, root.local);
        if (!decl) {
            if (this.options.unknown === 'error')
                throw new Error(
                    `Root element <${root.local}> is not declared in the schema`,
                );
            return genericValue(root);
        }
        return this.element(root, decl);
    }

    private unknown(what: string, parent: XmlElement): void {
        if (this.options.unknown === 'error')
            throw new Error(
                `${what} is not allowed in <${parent.local}> by the schema`,
            );
    }

    private typeOf(el: XmlElement, decl: ElementDecl): TypeDef {
        const xsiType = el.attrNS(XSI_NS, 'type');
        if (xsiType) {
            const q = el.resolveQName(xsiType);
            const t =
                q &&
                (this.schema.types.get(qkey(q)) ??
                    this.schema.builtin(q.local));
            if (t) return t;
        }
        return decl.type;
    }

    private element(el: XmlElement, decl: ElementDecl): unknown {
        const nil = el.attrNS(XSI_NS, 'nil');
        if (nil === 'true' || nil === '1') return null;

        const type = this.typeOf(el, decl);
        if (isAnyType(type)) return genericValue(el);
        if (type.kind === 'simple') return this.value(type, el.text);
        if (type.kind !== 'complex') return genericValue(el);

        const view = getContentView(type);
        if (!view.objectForm)
            return this.value(
                view.textType ?? this.schema.anySimpleType,
                el.text,
            );

        const obj: Record<string, unknown> = {};
        this.attributes(el, view, obj);
        this.children(el, view, obj);
        this.text(el, decl, view, obj);
        return obj;
    }

    private attributes(
        el: XmlElement,
        view: ContentView,
        obj: Record<string, unknown>,
    ): void {
        for (const attr of el.attrs) {
            if (attr.ns === XSI_NS) continue;
            const member = view.attributes.find(
                m =>
                    m.use.decl.name.local === attr.local &&
                    m.use.decl.name.ns === attr.ns,
            );
            if (member) {
                obj[member.key] = this.value(member.type, attr.value);
                continue;
            }
            const wildcard = view.attributeWildcard;
            if (wildcard && wildcardAllows(wildcard, attr.ns)) {
                obj[attr.local] = attr.value;
                continue;
            }
            this.unknown(`attribute "${attr.local}"`, el);
            if (this.options.unknown !== 'ignore') obj[attr.local] = attr.value;
        }
    }

    private children(
        el: XmlElement,
        view: ContentView,
        obj: Record<string, unknown>,
    ): void {
        for (const child of el.children) {
            const slot = findSlot(view, child);
            if (slot) {
                const value = this.element(child, slot.decl);
                if (slot.array) {
                    const list = (obj[slot.key] as unknown[] | undefined) ?? [];
                    list.push(value);
                    obj[slot.key] = list;
                } else {
                    push(obj, slot.key, value);
                }
                continue;
            }

            const wildcard = view.elementWildcard;
            if (wildcard && wildcardAllows(wildcard, child.ns)) {
                const global =
                    wildcard.processContents === 'skip'
                        ? undefined
                        : this.schema.elements.get(
                              qkey({ ns: child.ns, local: child.local }),
                          );
                push(
                    obj,
                    child.local,
                    global ? this.element(child, global) : genericValue(child),
                );
                continue;
            }
            this.unknown(`element <${child.local}>`, el);
            if (this.options.unknown !== 'ignore')
                push(obj, child.local, genericValue(child));
        }
    }

    private text(
        el: XmlElement,
        decl: ElementDecl,
        view: ContentView,
        obj: Record<string, unknown>,
    ): void {
        if (!view.hasText) return;
        const key = textKey(view, decl.name.local);
        const raw = el.text;

        if (view.textType) {
            if (raw !== '') obj[key] = this.value(view.textType, raw);
            else if (
                view.textType.valueKind === 'string' &&
                view.textType.variety === 'atomic'
            )
                obj[key] = '';
            return;
        }
        // mixed content: the text runs, concatenated
        if (raw.trim() !== '') obj[key] = raw;
    }
}

/**
 * Parse an XML document. The result is the value of the root element (its
 * attributes and children as properties), not wrapped in the element's name.
 */
export const parse = <T = Record<string, any>>(
    xml: string,
    schema?: SchemaSource,
    options: ParserOptions = {},
): T => {
    if (!schema) return genericValue(parseXml(xml)) as T;
    return new SchemaParser(
        resolveSchema(schema, options),
        options,
    ).parseDocument(xml) as T;
};

/**
 * Create a parser. With a schema (a path to an XSD or a compiled schema) values
 * are typed and arrays are arrays; without one, a loosely typed parse is done.
 * The schema is compiled once, when the parser is created.
 */
export const createParser = <T = Record<string, any>>(
    schema?: SchemaSource,
    options: ParserOptions = {},
): Parse<T> => {
    if (!schema) return (xml: string) => parse<T>(xml);
    const parser = new SchemaParser(resolveSchema(schema, options), options);
    return (xml: string) => parser.parseDocument(xml) as T;
};
