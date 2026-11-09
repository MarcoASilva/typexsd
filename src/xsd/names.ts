export const XSD_NS = 'http://www.w3.org/2001/XMLSchema';
export const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';
export const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
export const VC_NS = 'http://www.w3.org/2007/XMLSchema-versioning';

/** A qualified name. `ns` is `''` for "no namespace". */
export interface QName {
    ns: string;
    local: string;
}

export const qname = (ns: string, local: string): QName => ({ ns, local });

/** Clark notation (`{ns}local`, or just `local` without namespace). */
export const qkey = (q: QName): string =>
    q.ns ? `{${q.ns}}${q.local}` : q.local;

export const sameQName = (a: QName, b: QName): boolean =>
    a.ns === b.ns && a.local === b.local;

export const isNCName = (value: string): boolean =>
    /^[A-Za-z_\u00C0-\uFFFF][\w.\-\u00B7\u00C0-\uFFFF]*$/.test(value) &&
    !value.includes(':');

export const isQNameLexical = (value: string): boolean =>
    /^([A-Za-z_\u00C0-\uFFFF][\w.\-\u00B7\u00C0-\uFFFF]*:)?[A-Za-z_\u00C0-\uFFFF][\w.\-\u00B7\u00C0-\uFFFF]*$/.test(
        value,
    );
