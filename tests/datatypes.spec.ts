import { describe, expect, it } from 'vitest';
import { BUILTINS, isIntegerBuiltin } from '../src/xsd/datatypes/builtins';
import { applyWhiteSpace, builtinCodec } from '../src/xsd/datatypes/codecs';
import { coerceLoose } from '../src/runtime/values';

describe('whitespace normalization', () => {
    it('preserve keeps everything, replace swaps control characters, collapse trims and squeezes', () => {
        const input = ' a\tb\n\n c  ';
        expect(applyWhiteSpace(input, 'preserve')).toBe(input);
        expect(applyWhiteSpace(input, 'replace')).toBe(' a b   c  ');
        expect(applyWhiteSpace(input, 'collapse')).toBe('a b c');
    });

    it('uses the whitespace mode of each built-in', () => {
        expect(BUILTINS.get('string')!.whiteSpace).toBe('preserve');
        expect(BUILTINS.get('normalizedString')!.whiteSpace).toBe('replace');
        for (const n of ['token', 'integer', 'boolean', 'NMTOKENS', 'dateTime'])
            expect(BUILTINS.get(n)!.whiteSpace).toBe('collapse');
    });
});

describe('built-in registry', () => {
    it('records the applicable facets per primitive', () => {
        expect(BUILTINS.get('string')!.facets).toEqual(
            expect.arrayContaining([
                'length',
                'minLength',
                'maxLength',
                'pattern',
                'enumeration',
            ]),
        );
        expect(BUILTINS.get('string')!.facets).not.toContain('minInclusive');
        expect(BUILTINS.get('decimal')!.facets).toEqual(
            expect.arrayContaining([
                'totalDigits',
                'fractionDigits',
                'minInclusive',
                'maxExclusive',
            ]),
        );
        expect(BUILTINS.get('boolean')!.facets).not.toContain('enumeration');
        expect(BUILTINS.get('dateTime')!.facets).toContain('explicitTimezone');
        expect(BUILTINS.get('byte')!.facets).toEqual(
            BUILTINS.get('decimal')!.facets,
        );
    });

    it('knows which types are integers', () => {
        for (const n of [
            'integer',
            'long',
            'int',
            'short',
            'byte',
            'unsignedByte',
            'positiveInteger',
        ])
            expect(isIntegerBuiltin(n)).toBe(true);
        for (const n of ['decimal', 'string', 'double'])
            expect(isIntegerBuiltin(n)).toBe(false);
    });

    it('chains primitives correctly', () => {
        expect(BUILTINS.get('unsignedByte')!.primitive).toBe('decimal');
        expect(BUILTINS.get('ID')!.primitive).toBe('string');
        expect(BUILTINS.get('dayTimeDuration')!.primitive).toBe('duration');
        expect(BUILTINS.get('IDREFS')!.itemType).toBe('IDREF');
    });
});

describe('codecs', () => {
    it('booleans accept the four legal literals and write true/false', () => {
        const c = builtinCodec('boolean');
        expect(['true', 'false', '1', '0'].map(c.parse)).toEqual([
            true,
            false,
            true,
            false,
        ]);
        expect(c.parse('yes')).toBe('yes');
        expect([true, false, 1, 0].map(c.format)).toEqual([
            'true',
            'false',
            'true',
            'false',
        ]);
    });

    it('decimals and integers parse to numbers and refuse garbage', () => {
        for (const n of ['decimal', 'integer', 'int', 'positiveInteger']) {
            const c = builtinCodec(n);
            expect(c.parse('12')).toBe(12);
            expect(c.parse('-1.50')).toBe(-1.5);
            expect(c.parse('+.5')).toBe(0.5);
            expect(c.parse('1e3')).toBe('1e3');
            expect(c.parse('')).toBe('');
        }
        expect(builtinCodec('decimal').format(1e21)).not.toMatch(/e/i);
        expect(
            builtinCodec('decimal').format(BigInt('12345678901234567890')),
        ).toBe('12345678901234567890');
    });

    it('floats and doubles know INF and NaN', () => {
        const c = builtinCodec('double');
        expect([c.parse('INF'), c.parse('-INF'), c.parse('1.5e3')]).toEqual([
            Infinity,
            -Infinity,
            1500,
        ]);
        expect(c.parse('NaN')).toBeNaN();
        expect([Infinity, -Infinity, NaN, 2.5].map(c.format)).toEqual([
            'INF',
            '-INF',
            'NaN',
            '2.5',
        ]);
    });

    it('binary types round-trip bytes', () => {
        const hex = builtinCodec('hexBinary');
        const b64 = builtinCodec('base64Binary');
        expect([...(hex.parse('00ff') as Buffer)]).toEqual([0, 255]);
        expect(hex.format(new Uint8Array([0, 255]))).toBe('00FF');
        expect(hex.parse('zz')).toBe('zz');
        expect((b64.parse('aGk=') as Buffer).toString()).toBe('hi');
        expect(b64.format(Buffer.from('hi'))).toBe('aGk=');
    });

    it('temporal types stay strings but accept Date when writing', () => {
        const d = new Date('2021-03-04T05:06:07.000Z');
        expect(builtinCodec('dateTime').parse('2021-03-04T05:06:07')).toBe(
            '2021-03-04T05:06:07',
        );
        expect(builtinCodec('dateTime').format(d)).toBe(
            '2021-03-04T05:06:07.000Z',
        );
        expect(builtinCodec('date').format(d)).toBe('2021-03-04');
        expect(builtinCodec('time').format(d)).toBe('05:06:07.000Z');
    });

    it('everything else is a string', () => {
        expect(builtinCodec('token').parse('a')).toBe('a');
        expect(builtinCodec('unknown-type').parse('a')).toBe('a');
        expect(builtinCodec('anyURI').format('http://x')).toBe('http://x');
    });
});

describe('loose coercion (schema-less parsing)', () => {
    it('only converts what is unambiguously a JSON number or boolean', () => {
        expect(['1', '-2.5', '1e3', '0'].map(coerceLoose)).toEqual([
            1, -2.5, 1000, 0,
        ]);
        expect(
            ['007', '1.', '.5', '0x10', 'TRUE', '', ' 1', 'null'].map(
                coerceLoose,
            ),
        ).toEqual(['007', '1.', '.5', '0x10', 'TRUE', '', ' 1', 'null']);
        expect([coerceLoose('true'), coerceLoose('false')]).toEqual([
            true,
            false,
        ]);
    });
});
