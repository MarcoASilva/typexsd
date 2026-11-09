/**
 * A tiny XML serializer. The builder assembles an `XmlOut` tree and this turns
 * it into text: two-space indentation, `<a/>` for empty elements, and no
 * indentation inside mixed content (where whitespace would change the data).
 */

export class XmlOut {
    readonly attrs: Array<[string, string]> = [];
    readonly children: Array<XmlOut | string> = [];

    constructor(public readonly name: string) {}

    att(name: string, value: string): this {
        const existing = this.attrs.find(([n]) => n === name);
        if (existing) existing[1] = value;
        else this.attrs.push([name, value]);
        return this;
    }

    ele(name: string): XmlOut {
        const child = new XmlOut(name);
        this.children.push(child);
        return child;
    }

    text(value: string): this {
        if (value !== '') this.children.push(value);
        return this;
    }
}

const escapeText = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r/g, '&#xD;');

const escapeAttribute = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/\t/g, '&#x9;')
        .replace(/\n/g, '&#xA;')
        .replace(/\r/g, '&#xD;');

const open = (el: XmlOut): string =>
    `<${el.name}${el.attrs
        .map(([n, v]) => ` ${n}="${escapeAttribute(v)}"`)
        .join('')}`;

const compact = (el: XmlOut): string => {
    if (!el.children.length) return `${open(el)}/>`;
    const inner = el.children
        .map(c => (typeof c === 'string' ? escapeText(c) : compact(c)))
        .join('');
    return `${open(el)}>${inner}</${el.name}>`;
};

const pretty = (el: XmlOut, depth: number, indent: string): string => {
    const pad = indent.repeat(depth);
    if (!el.children.length) return `${pad}${open(el)}/>`;

    const hasText = el.children.some(c => typeof c === 'string');
    if (hasText) {
        // text (alone or mixed with elements) is written inline
        return pad + compact(el);
    }
    const inner = el.children
        .map(c => pretty(c as XmlOut, depth + 1, indent))
        .join('\n');
    return `${pad}${open(el)}>\n${inner}\n${pad}</${el.name}>`;
};

export interface SerializeOptions {
    pretty: boolean;
    declaration: boolean;
}

export const serialize = (root: XmlOut, options: SerializeOptions): string => {
    const body = options.pretty ? pretty(root, 0, '  ') : compact(root);
    if (!options.declaration) return body;
    return `<?xml version="1.0"?>${options.pretty ? '\n' : ''}${body}`;
};
