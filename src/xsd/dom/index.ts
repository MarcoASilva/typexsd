import sax from 'sax';
import { QName, XML_NS } from '../names';

export interface XmlAttr {
    ns: string;
    local: string;
    prefix: string;
    value: string;
}

/** Ordered child of an element: either a nested element or a text run. */
export type XmlContent = XmlElement | string;

/**
 * Minimal namespace-aware element tree.
 *
 * Every prefix is resolved against the in-scope `xmlns` declarations, so the
 * rest of the library never has to care which prefix a document uses for the
 * XSD namespace (`xsd:`, `xs:`, a default namespace, anything).
 */
export class XmlElement {
    readonly attrs: XmlAttr[] = [];
    readonly content: XmlContent[] = [];
    readonly nsDecls = new Map<string, string>();
    parent?: XmlElement;
    /** 1-based line of the start tag. */
    line?: number;

    constructor(
        public readonly ns: string,
        public readonly local: string,
        public readonly prefix: string,
    ) {}

    get children(): XmlElement[] {
        return this.content.filter(
            (c): c is XmlElement => typeof c !== 'string',
        );
    }

    /** Concatenation of the element's own text runs. */
    get text(): string {
        return this.content.filter(c => typeof c === 'string').join('');
    }

    /** Value of a no-namespace attribute. */
    attr(local: string): string | undefined {
        return this.attrs.find(a => a.ns === '' && a.local === local)?.value;
    }

    attrNS(ns: string, local: string): string | undefined {
        return this.attrs.find(a => a.ns === ns && a.local === local)?.value;
    }

    hasAttr(local: string): boolean {
        return this.attr(local) !== undefined;
    }

    /** Namespace URI bound to `prefix` ('' = default namespace) at this element. */
    lookupNamespace(prefix: string): string | undefined {
        if (prefix === 'xml') return XML_NS;
        let el: XmlElement | undefined = this;
        while (el) {
            const uri = el.nsDecls.get(prefix);
            if (uri !== undefined) return uri;
            el = el.parent;
        }
        return prefix === '' ? '' : undefined;
    }

    /**
     * Resolve a lexical QName (`prefix:local` or `local`) using the in-scope
     * namespaces. Unprefixed names use the default namespace (this is the rule
     * for QName-typed attribute values such as `type` and `ref`).
     * Returns `undefined` when the prefix is not bound.
     */
    resolveQName(
        lexical: string,
        useDefaultNamespace = true,
    ): QName | undefined {
        const value = lexical.trim();
        const i = value.indexOf(':');
        if (i < 0) {
            const ns = useDefaultNamespace
                ? this.lookupNamespace('') ?? ''
                : '';
            return { ns, local: value };
        }
        const ns = this.lookupNamespace(value.slice(0, i));
        if (ns === undefined) return undefined;
        return { ns, local: value.slice(i + 1) };
    }

    /** Human readable location, e.g. `/schema/complexType[@name='x']/sequence`. */
    get path(): string {
        const parts: string[] = [];
        for (let el: XmlElement | undefined = this; el; el = el.parent) {
            const id = el.attr('name') ?? el.attr('ref');
            parts.unshift(
                id !== undefined ? `${el.local}[@name='${id}']` : el.local,
            );
        }
        return '/' + parts.join('/');
    }
}

export class XmlSyntaxError extends Error {
    constructor(message: string, public readonly file?: string) {
        super(file ? `${message} (${file})` : message);
        this.name = 'XmlSyntaxError';
    }
}

const splitName = (name: string): [string, string] => {
    const i = name.indexOf(':');
    return i < 0 ? ['', name] : [name.slice(0, i), name.slice(i + 1)];
};

const createElement = (
    rawName: string,
    attributes: Record<string, string>,
    parent: XmlElement | undefined,
): XmlElement => {
    // namespace declarations first: they apply to the element itself
    const decls = new Map<string, string>();
    for (const [name, value] of Object.entries(attributes)) {
        if (name === 'xmlns') decls.set('', value);
        else if (name.startsWith('xmlns:')) decls.set(name.slice(6), value);
    }

    const probe = new XmlElement('', '', '');
    probe.parent = parent;
    for (const [p, u] of decls) probe.nsDecls.set(p, u);

    const [prefix, local] = splitName(rawName);
    const ns = probe.lookupNamespace(prefix);
    if (ns === undefined)
        throw new XmlSyntaxError(`Unbound namespace prefix "${prefix}"`);

    const el = new XmlElement(ns, local, prefix);
    el.parent = parent;
    for (const [p, u] of decls) el.nsDecls.set(p, u);

    for (const [name, value] of Object.entries(attributes)) {
        if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
        const [aPrefix, aLocal] = splitName(name);
        let aNs = '';
        if (aPrefix) {
            const resolved = el.lookupNamespace(aPrefix);
            if (resolved === undefined)
                throw new XmlSyntaxError(
                    `Unbound namespace prefix "${aPrefix}"`,
                );
            aNs = resolved;
        }
        el.attrs.push({ ns: aNs, local: aLocal, prefix: aPrefix, value });
    }
    return el;
};

/** Decode XML bytes honoring BOM and the `encoding` pseudo-attribute. */
export const decodeXml = (data: Uint8Array): string => {
    const buf = Buffer.from(data);
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
        return buf.subarray(3).toString('utf8');
    if (buf[0] === 0xff && buf[1] === 0xfe)
        return buf.subarray(2).toString('utf16le');
    if (buf[0] === 0xfe && buf[1] === 0xff) {
        const swapped = Buffer.from(buf.subarray(2));
        swapped.swap16();
        return swapped.toString('utf16le');
    }
    const head = buf.subarray(0, 200).toString('latin1');
    const match = /^<\?xml[^>]*\sencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(
        head,
    );
    const label = match?.[1]?.toLowerCase();
    if (!label || label === 'utf-8' || label === 'utf8')
        return buf.toString('utf8');
    try {
        return new TextDecoder(label).decode(buf);
    } catch {
        return buf.toString('utf8');
    }
};

/**
 * Parse XML text into a namespace-aware tree and return the root element.
 * Malformed documents throw an `XmlSyntaxError` with line information.
 */
export const parseXml = (xml: string, file?: string): XmlElement => {
    const parser = sax.parser(true, {
        trim: false,
        normalize: false,
        position: true,
    });
    let root: XmlElement | undefined;
    let current: XmlElement | undefined;
    let failure: XmlSyntaxError | undefined;

    const fail = (message: string): void => {
        if (!failure)
            failure = new XmlSyntaxError(
                `Malformed XML at line ${parser.line + 1}, column ${
                    parser.column + 1
                }: ${message}`,
                file,
            );
    };

    const addText = (text: string): void => {
        if (!current || text === '') return;
        const last = current.content[current.content.length - 1];
        if (typeof last === 'string')
            current.content[current.content.length - 1] = last + text;
        else current.content.push(text);
    };

    parser.onerror = error => {
        fail(error.message.split('\n')[0]);
        // sax stops at the first error unless resumed; we stop too
        parser.error = null as unknown as Error;
    };
    parser.onopentag = tag => {
        if (failure) return;
        try {
            const el = createElement(
                tag.name,
                tag.attributes as Record<string, string>,
                current,
            );
            el.line = parser.line + 1;
            if (current) current.content.push(el);
            else if (!root) root = el;
            current = el;
        } catch (error) {
            if (error instanceof XmlSyntaxError) fail(error.message);
            else throw error;
        }
    };
    parser.onclosetag = () => {
        if (failure || !current) return;
        // whitespace between child elements is not significant
        if (current.children.length)
            current.content.splice(
                0,
                current.content.length,
                ...current.content.filter(
                    c => typeof c !== 'string' || c.trim() !== '',
                ),
            );
        current = current.parent;
    };
    parser.ontext = text => addText(text);
    parser.oncdata = text => addText(text);

    parser.write(xml).close();

    if (failure) throw failure;
    if (!root) throw new XmlSyntaxError('Document has no root element', file);
    return root;
};
