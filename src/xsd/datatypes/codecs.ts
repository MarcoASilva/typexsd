import { BUILTINS, ValueKind, WhiteSpace } from './builtins';

/** Lexical <-> JavaScript value conversion for a built-in datatype. */
export interface Codec {
    parse(lexical: string): unknown;
    format(value: unknown): string;
}

export const applyWhiteSpace = (value: string, mode: WhiteSpace): string => {
    if (mode === 'preserve') return value;
    const replaced = value.replace(/[\t\n\r]/g, ' ');
    return mode === 'replace'
        ? replaced
        : replaced.replace(/ +/g, ' ').replace(/^ | $/g, '');
};

const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

const formatNumber = (n: number): string => {
    if (Number.isNaN(n)) return 'NaN';
    if (n === Infinity) return 'INF';
    if (n === -Infinity) return '-INF';
    const s = String(n);
    if (!/e/i.test(s)) return s;
    // avoid exponent notation: decimal/integer lexical forms do not allow it
    return n.toLocaleString('fullwide', {
        useGrouping: false,
        maximumFractionDigits: 20,
    });
};

const stringCodec: Codec = {
    parse: lexical => lexical,
    format: value => String(value),
};

const booleanCodec: Codec = {
    parse: lexical => {
        if (lexical === 'true' || lexical === '1') return true;
        if (lexical === 'false' || lexical === '0') return false;
        return lexical;
    },
    format: value => {
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (value === 1 || value === 0) return String(value === 1);
        return String(value);
    },
};

const decimalCodec: Codec = {
    parse: lexical =>
        DECIMAL.test(lexical) ? Number(lexical) : (lexical as unknown),
    format: value => {
        if (typeof value === 'number') return formatNumber(value);
        if (typeof value === 'bigint') return value.toString();
        return String(value);
    },
};

const floatCodec: Codec = {
    parse: lexical => {
        if (lexical === 'INF' || lexical === '+INF') return Infinity;
        if (lexical === '-INF') return -Infinity;
        if (lexical === 'NaN') return NaN;
        const n = Number(lexical);
        return lexical !== '' && !Number.isNaN(n) ? n : lexical;
    },
    format: value => {
        if (typeof value === 'number') return formatNumber(value);
        return String(value);
    },
};

const isBytes = (value: unknown): value is Uint8Array =>
    value instanceof Uint8Array;

const hexCodec: Codec = {
    parse: lexical =>
        /^([0-9a-fA-F]{2})*$/.test(lexical)
            ? Buffer.from(lexical, 'hex')
            : lexical,
    format: value =>
        isBytes(value)
            ? Buffer.from(value).toString('hex').toUpperCase()
            : String(value),
};

const base64Codec: Codec = {
    parse: lexical =>
        /^[A-Za-z0-9+/=\s]*$/.test(lexical)
            ? Buffer.from(lexical.replace(/\s+/g, ''), 'base64')
            : lexical,
    format: value =>
        isBytes(value) ? Buffer.from(value).toString('base64') : String(value),
};

/** dateTime / date / time stay lexical strings on parse; `Date` is accepted on build. */
const dateCodec = (primitive: string): Codec => ({
    parse: lexical => lexical,
    format: value => {
        if (!(value instanceof Date)) return String(value);
        const iso = value.toISOString();
        if (primitive === 'date') return iso.slice(0, 10);
        if (primitive === 'time') return iso.slice(11);
        return iso;
    },
});

const codecFor = (kind: ValueKind, primitive?: string): Codec => {
    switch (kind) {
        case 'boolean':
            return booleanCodec;
        case 'number':
            return primitive === 'decimal' ? decimalCodec : floatCodec;
        case 'binary-hex':
            return hexCodec;
        case 'binary-base64':
            return base64Codec;
        case 'date':
            return dateCodec(primitive ?? 'dateTime');
        default:
            return stringCodec;
    }
};

/** Codec for a built-in datatype by local name (defaults to string handling). */
export const builtinCodec = (local: string): Codec => {
    const info = BUILTINS.get(local);
    if (!info) return stringCodec;
    return codecFor(info.valueKind, info.primitive);
};

export const stringValueCodec = stringCodec;
