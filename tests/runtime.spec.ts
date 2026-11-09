import { describe, expect, it } from 'vitest';
import { compileXsd, createBuilder, createParser, parse } from '../src';
import { XS, schemaXml } from './helpers';

const schemaOf = (body: string, attrs = '') =>
    compileXsd(schemaXml(body, attrs));
const el = (n: string, type = 'xs:string', attrs = '') =>
    `<xs:element name="${n}" type="${type}" ${attrs}/>`;

const roundTrip = (body: string, root: string, data: unknown, attrs = '') => {
    const schema = schemaOf(body, attrs);
    const xml = createBuilder(schema)({ [root]: data }, root);
    return { xml, parsed: createParser(schema)(xml) };
};

describe('builder', () => {
    const body = `<xs:element name="doc"><xs:complexType><xs:sequence>
        ${el('title')}${el('count', 'xs:int')}${el(
        'tag',
        'xs:string',
        'minOccurs="0" maxOccurs="unbounded"',
    )}
      </xs:sequence><xs:attribute name="id" type="xs:string"/><xs:attribute name="draft" type="xs:boolean"/></xs:complexType></xs:element>`;

    it('emits elements in schema order, not data order, and attributes first', () => {
        const build = createBuilder(schemaOf(body));
        const xml = build(
            {
                doc: {
                    tag: ['x', 'y'],
                    count: 3,
                    draft: true,
                    title: 'T',
                    id: 'i1',
                },
            },
            'doc',
        );
        expect(xml).toBe(`<?xml version="1.0"?>
<doc id="i1" draft="true">
  <title>T</title>
  <count>3</count>
  <tag>x</tag>
  <tag>y</tag>
</doc>`);
    });

    it('supports compact output without declaration', () => {
        const build = createBuilder(schemaOf(body), {
            pretty: false,
            declaration: false,
        });
        expect(build({ doc: { title: 'T', count: 1 } }, 'doc')).toBe(
            '<doc><title>T</title><count>1</count></doc>',
        );
    });

    it('accepts a single value where an array is expected, and skips undefined/null', () => {
        const build = createBuilder(schemaOf(body), {
            pretty: false,
            declaration: false,
        });
        expect(
            build({ doc: { title: 'T', count: 1, tag: 'one' } }, 'doc'),
        ).toContain('<tag>one</tag>');
        expect(
            build(
                { doc: { title: 'T', count: undefined, tag: [null, 'a'] } },
                'doc',
            ),
        ).toBe('<doc><title>T</title><tag>a</tag></doc>');
    });

    it('escapes text and attribute values', () => {
        const build = createBuilder(schemaOf(body), {
            pretty: false,
            declaration: false,
        });
        expect(build({ doc: { title: 'a < b & "c"', id: 'x"y' } }, 'doc')).toBe(
            '<doc id="x&quot;y"><title>a &lt; b &amp; "c"</title></doc>',
        );
    });

    it('formats values through their datatype', () => {
        const schema =
            schemaOf(`<xs:element name="v"><xs:complexType><xs:sequence>
            ${el('flag', 'xs:boolean')}${el('dec', 'xs:decimal')}${el(
                'big',
                'xs:double',
            )}${el('when', 'xs:dateTime')}
            ${el('day', 'xs:date')}${el('hex', 'xs:hexBinary')}${el(
                'b64',
                'xs:base64Binary',
            )}
            <xs:element name="ids"><xs:simpleType><xs:list itemType="xs:int"/></xs:simpleType></xs:element>
            <xs:element name="u"><xs:simpleType><xs:union memberTypes="xs:int xs:boolean"/></xs:simpleType></xs:element>
        </xs:sequence></xs:complexType></xs:element>`);
        const xml = createBuilder(schema, {
            pretty: false,
            declaration: false,
        })(
            {
                v: {
                    flag: false,
                    dec: 1.5,
                    big: Infinity,
                    when: new Date('2020-01-02T03:04:05.000Z'),
                    day: new Date('2020-01-02T03:04:05.000Z'),
                    hex: Buffer.from([1, 171]),
                    b64: Buffer.from('hello'),
                    ids: [1, 2, 3],
                    u: true,
                },
            },
            'v',
        );
        expect(xml).toBe(
            '<v><flag>false</flag><dec>1.5</dec><big>INF</big><when>2020-01-02T03:04:05.000Z</when><day>2020-01-02</day><hex>01AB</hex><b64>aGVsbG8=</b64><ids>1 2 3</ids><u>true</u></v>',
        );
    });

    it('writes xsi:nil for null nillable elements and skips null otherwise', () => {
        const schema =
            schemaOf(`<xs:element name="r"><xs:complexType><xs:sequence>
            ${el('n', 'xs:int', 'nillable="true"')}${el(
                'm',
                'xs:int',
                'minOccurs="0"',
            )}</xs:sequence></xs:complexType></xs:element>`);
        const xml = createBuilder(schema, {
            pretty: false,
            declaration: false,
        })({ r: { n: null, m: null } }, 'r');
        expect(xml).toBe(
            '<r><n xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/></r>',
        );
    });

    it('writes only the chosen branch of a choice and every member of a repeating one', () => {
        const schema = schemaOf(`
            <xs:element name="pick"><xs:complexType><xs:choice>${el('a')}${el(
            'b',
        )}</xs:choice></xs:complexType></xs:element>
            <xs:element name="bag"><xs:complexType><xs:choice maxOccurs="unbounded">${el(
                'x',
            )}${el('y')}</xs:choice></xs:complexType></xs:element>`);
        const build = createBuilder(schema, {
            pretty: false,
            declaration: false,
        });
        expect(build({ pick: { b: '1' } }, 'pick')).toBe(
            '<pick><b>1</b></pick>',
        );
        expect(build({ bag: { y: ['1', '2'], x: ['0'] } }, 'bag')).toBe(
            '<bag><x>0</x><y>1</y><y>2</y></bag>',
        );
    });

    it('writes mixed content text and simple content values', () => {
        const schema = schemaOf(`
            <xs:element name="p"><xs:complexType mixed="true"><xs:sequence minOccurs="0">${el(
                'b',
            )}</xs:sequence></xs:complexType></xs:element>
            <xs:element name="price"><xs:complexType><xs:simpleContent><xs:extension base="xs:decimal"><xs:attribute name="cur" type="xs:string"/></xs:extension></xs:simpleContent></xs:complexType></xs:element>
            <xs:element name="n" type="xs:int"/>`);
        const build = createBuilder(schema, {
            pretty: false,
            declaration: false,
        });
        expect(build({ p: { p: 'hello ', b: 'bold' } }, 'p')).toBe(
            '<p>hello <b>bold</b></p>',
        );
        expect(build({ price: { cur: 'EUR', price: 9.5 } }, 'price')).toBe(
            '<price cur="EUR">9.5</price>',
        );
        expect(build({ price: 9.5 }, 'price')).toBe('<price>9.5</price>');
        expect(build({ n: 4 }, 'n')).toBe('<n>4</n>');
    });

    it('emits substitution group members', () => {
        const schema = schemaOf(`
            <xs:element name="shape" type="xs:string" abstract="true"/>
            <xs:element name="circle" substitutionGroup="shape"/>
            <xs:element name="square" substitutionGroup="shape"/>
            <xs:element name="canvas"><xs:complexType><xs:sequence><xs:element ref="shape" maxOccurs="unbounded"/></xs:sequence></xs:complexType></xs:element>`);
        const build = createBuilder(schema, {
            pretty: false,
            declaration: false,
        });
        expect(
            build({ canvas: { circle: ['c'], square: ['s'] } }, 'canvas'),
        ).toBe('<canvas><circle>c</circle><square>s</square></canvas>');
    });

    it('passes wildcard content through', () => {
        const schema = schemaOf(`
            <xs:element name="any"><xs:complexType mixed="true"><xs:sequence minOccurs="0" maxOccurs="unbounded"><xs:any processContents="lax"/></xs:sequence><xs:anyAttribute/></xs:complexType></xs:element>
            <xs:element name="free"/>`);
        const build = createBuilder(schema, {
            pretty: false,
            declaration: false,
        });
        expect(
            build(
                {
                    any: {
                        '@x': 'attr',
                        extra: { '#text': 'hi', '@k': 1, deep: [1, 2] },
                        other: 'o',
                    },
                },
                'any',
            ),
        ).toBe(
            '<any x="attr"><extra k="1">hi<deep>1</deep><deep>2</deep></extra><other>o</other></any>',
        );
        expect(build({ free: { a: 'b' } }, 'free')).toBe(
            '<free><a>b</a></free>',
        );
    });

    it('declares namespaces, honoring elementFormDefault', () => {
        const body = `<xs:element name="root"><xs:complexType><xs:sequence>${el(
            'child',
        )}</xs:sequence><xs:attribute name="a" type="xs:string"/></xs:complexType></xs:element>`;
        const unqualified = createBuilder(
            schemaOf(body, 'targetNamespace="urn:t"'),
            { pretty: false, declaration: false },
        );
        expect(unqualified({ root: { a: '1', child: 'c' } }, 'root')).toBe(
            '<root xmlns="urn:t" a="1"><child xmlns="">c</child></root>',
        );
        const qualified = createBuilder(
            schemaOf(
                body,
                'targetNamespace="urn:t" elementFormDefault="qualified"',
            ),
            { pretty: false, declaration: false },
        );
        expect(qualified({ root: { a: '1', child: 'c' } }, 'root')).toBe(
            '<root xmlns="urn:t" a="1"><child>c</child></root>',
        );
    });

    it('declares prefixes for qualified attributes and uses xml: directly', () => {
        const schema = compileXsd(
            schemaXml(
                `<xs:element name="r"><xs:complexType><xs:attribute name="q" type="xs:string" form="qualified"/><xs:attribute ref="xml:lang"/></xs:complexType></xs:element>`,
                'targetNamespace="urn:t" xmlns:xml="http://www.w3.org/XML/1998/namespace"',
            ),
        );
        const xml = createBuilder(schema, {
            pretty: false,
            declaration: false,
        })({ r: { q: '1', lang: 'en' } }, 'r');
        expect(xml).toBe(
            '<r xmlns="urn:t" xmlns:ns1="urn:t" ns1:q="1" xml:lang="en"/>',
        );
    });

    it('explains unknown elements and missing data', () => {
        const build = createBuilder(schemaOf(body));
        expect(() => build({ nope: {} }, 'nope')).toThrow(
            /not declared in the schema/,
        );
        expect(() => build({} as any, 'doc')).toThrow(/no "doc" property/);
        expect(() => build({ doc: 5 }, 'doc')).toThrow(/expected an object/);
    });

    it('finds elements by Schema property name when local names collide across namespaces', () => {
        const schema = compileXsd(
            `<xs:schema xmlns:xs="${XS}" xmlns:b="urn:b" targetNamespace="urn:a"><xs:import namespace="urn:b" schemaLocation="b.xsd"/>${el(
                'e',
            )}</xs:schema>`,
            {
                sources: {
                    'b.xsd': `<xs:schema xmlns:xs="${XS}" targetNamespace="urn:b"><xs:element name="e" type="xs:int"/></xs:schema>`,
                },
            },
        );
        const build = createBuilder(schema, {
            pretty: false,
            declaration: false,
        });
        expect(build({ e: 'a' }, 'e')).toBe('<e xmlns="urn:a">a</e>');
        expect(build({ e_2: 5 }, 'e_2')).toBe('<e xmlns="urn:b">5</e>');
    });
});

describe('parser', () => {
    it('coerces values by datatype, not by what they look like', () => {
        const schema =
            schemaOf(`<xs:element name="v"><xs:complexType><xs:sequence>
            ${el('s')}${el('i', 'xs:int')}${el('b', 'xs:boolean')}${el(
                'd',
                'xs:decimal',
            )}${el('f', 'xs:double')}
            ${el('code')}${el('when', 'xs:dateTime')}${el(
                'hex',
                'xs:hexBinary',
            )}${el('b64', 'xs:base64Binary')}
        </xs:sequence></xs:complexType></xs:element>`);
        const xml = `<v><s>007</s><i> 42 </i><b>1</b><d>1.50</d><f>-INF</f><code>true</code><when>2020-01-02T03:04:05</when><hex>01AB</hex><b64>aGVsbG8=</b64></v>`;
        const v: any = createParser(schema)(xml);
        expect(v.s).toBe('007');
        expect(v.i).toBe(42);
        expect(v.b).toBe(true);
        expect(v.d).toBe(1.5);
        expect(v.f).toBe(-Infinity);
        expect(v.code).toBe('true');
        expect(v.when).toBe('2020-01-02T03:04:05');
        expect(Buffer.isBuffer(v.hex) && [...v.hex]).toEqual([1, 171]);
        expect(v.b64.toString()).toBe('hello');
    });

    it('applies whitespace facets and keeps invalid lexical forms as strings', () => {
        const schema =
            schemaOf(`<xs:element name="v"><xs:complexType><xs:sequence>
            ${el('t', 'xs:token')}${el('n', 'xs:string')}${el(
                'bad',
                'xs:int',
            )}${el(
                'badBool',
                'xs:boolean',
            )}</xs:sequence></xs:complexType></xs:element>`);
        const v: any = createParser(schema)(
            `<v><t>  a   b </t><n>  keep  </n><bad>x1</bad><badBool>yes</badBool></v>`,
        );
        expect(v).toEqual({
            t: 'a b',
            n: '  keep  ',
            bad: 'x1',
            badBool: 'yes',
        });
    });

    it('can return Date objects for dateTime and date', () => {
        const schema =
            schemaOf(`<xs:element name="v"><xs:complexType><xs:sequence>
            ${el('at', 'xs:dateTime')}${el('day', 'xs:date')}${el(
                'bad',
                'xs:dateTime',
            )}${el(
                't',
                'xs:time',
            )}</xs:sequence></xs:complexType></xs:element>`);
        const xml = `<v><at>2020-01-02T03:04:05Z</at><day>2020-01-02</day><bad>soon</bad><t>03:04:05</t></v>`;
        const v: any = createParser(schema, { dates: true })(xml);
        expect(v.at).toEqual(new Date('2020-01-02T03:04:05Z'));
        expect(v.day).toEqual(new Date('2020-01-02'));
        expect([v.bad, v.t]).toEqual(['soon', '03:04:05']);
        expect((createParser(schema)(xml) as any).at).toBe(
            '2020-01-02T03:04:05Z',
        );
    });

    it('parses lists and unions', () => {
        const schema =
            schemaOf(`<xs:element name="v"><xs:complexType><xs:sequence>
            <xs:element name="ids"><xs:simpleType><xs:list itemType="xs:int"/></xs:simpleType></xs:element>
            <xs:element name="u1"><xs:simpleType><xs:union memberTypes="xs:int xs:boolean xs:string"/></xs:simpleType></xs:element>
            <xs:element name="u2"><xs:simpleType><xs:union memberTypes="xs:int xs:boolean xs:string"/></xs:simpleType></xs:element>
            <xs:element name="u3"><xs:simpleType><xs:union memberTypes="xs:int xs:boolean xs:string"/></xs:simpleType></xs:element>
            </xs:sequence><xs:attribute name="tags" type="xs:NMTOKENS"/></xs:complexType></xs:element>`);
        const v: any = createParser(schema)(
            `<v tags="a  b c"><ids> 1 2   3 </ids><u1>5</u1><u2>true</u2><u3>word</u3></v>`,
        );
        expect(v).toEqual({
            tags: ['a', 'b', 'c'],
            ids: [1, 2, 3],
            u1: 5,
            u2: true,
            u3: 'word',
        });
    });

    it('returns arrays for repeatable elements even with a single occurrence', () => {
        const schema =
            schemaOf(`<xs:element name="r"><xs:complexType><xs:sequence>
            ${el('many', 'xs:string', 'maxOccurs="unbounded"')}${el('one')}${el(
                'opt',
                'xs:string',
                'minOccurs="0"',
            )}</xs:sequence></xs:complexType></xs:element>`);
        const v: any = createParser(schema)(
            `<r><many>a</many><one>b</one></r>`,
        );
        expect(v).toEqual({ many: ['a'], one: 'b' });
    });

    it('flattens attributes next to children and puts text under the element name', () => {
        const schema = schemaOf(`
            <xs:element name="price"><xs:complexType><xs:simpleContent><xs:extension base="xs:decimal">
                <xs:attribute name="cur" type="xs:string"/></xs:extension></xs:simpleContent></xs:complexType></xs:element>
            <xs:element name="p"><xs:complexType mixed="true"><xs:sequence minOccurs="0" maxOccurs="unbounded">${el(
                'b',
            )}</xs:sequence></xs:complexType></xs:element>
            <xs:element name="empty"><xs:complexType><xs:attribute name="a" type="xs:string"/></xs:complexType></xs:element>
            <xs:element name="blank"><xs:complexType><xs:simpleContent><xs:extension base="xs:string"><xs:attribute name="a" type="xs:string"/></xs:extension></xs:simpleContent></xs:complexType></xs:element>`);
        const parseDoc = createParser(schema);
        expect(parseDoc(`<price cur="EUR">9.50</price>`)).toEqual({
            cur: 'EUR',
            price: 9.5,
        });
        expect(parseDoc(`<p>Hello <b>bold</b> and <b>more</b>!</p>`)).toEqual({
            b: ['bold', 'more'],
            p: 'Hello  and !',
        });
        expect(parseDoc(`<p>   </p>`)).toEqual({});
        expect(parseDoc(`<empty a="1"/>`)).toEqual({ a: '1' });
        expect(parseDoc(`<empty/>`)).toEqual({});
        expect(parseDoc(`<blank a="1"/>`)).toEqual({ a: '1', blank: '' });
    });

    it('parses xsi:nil as null and honors xsi:type', () => {
        const schema = schemaOf(`
            <xs:complexType name="base"><xs:sequence>${el(
                'a',
            )}</xs:sequence></xs:complexType>
            <xs:complexType name="derived"><xs:complexContent><xs:extension base="base"><xs:sequence>${el(
                'b',
                'xs:int',
            )}</xs:sequence></xs:extension></xs:complexContent></xs:complexType>
            <xs:element name="r"><xs:complexType><xs:sequence>
                <xs:element name="n" type="xs:int" nillable="true"/>
                <xs:element name="x" type="base"/></xs:sequence></xs:complexType></xs:element>`);
        const v: any = createParser(schema)(
            `<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><n xsi:nil="true"/><x xsi:type="derived"><a>1</a><b>2</b></x></r>`,
        );
        expect(v).toEqual({ n: null, x: { a: '1', b: 2 } });
    });

    it('handles namespaces, including documents that qualify every element', () => {
        const schema = schemaOf(
            `<xs:element name="root"><xs:complexType><xs:sequence>${el(
                'child',
            )}</xs:sequence></xs:complexType></xs:element>`,
            'targetNamespace="urn:t"',
        );
        const parseDoc = createParser(schema);
        expect(parseDoc(`<root xmlns="urn:t"><child>c</child></root>`)).toEqual(
            { child: 'c' },
        );
        expect(
            parseDoc(`<t:root xmlns:t="urn:t"><child>c</child></t:root>`),
        ).toEqual({ child: 'c' });
    });

    it('substitution group members land under their own names', () => {
        const schema = schemaOf(`
            <xs:element name="shape" type="xs:string" abstract="true"/>
            <xs:element name="circle" substitutionGroup="shape"/>
            <xs:element name="square" substitutionGroup="shape"/>
            <xs:element name="canvas"><xs:complexType><xs:sequence><xs:element ref="shape" maxOccurs="unbounded"/></xs:sequence></xs:complexType></xs:element>`);
        expect(
            createParser(schema)(
                `<canvas><circle>c</circle><square>s</square><circle>d</circle></canvas>`,
            ),
        ).toEqual({
            circle: ['c', 'd'],
            square: ['s'],
        });
    });

    it('handles wildcards: global declarations are used, the rest stays loose', () => {
        const schema = schemaOf(`
            <xs:element name="known" type="xs:int"/>
            <xs:element name="holder"><xs:complexType><xs:sequence><xs:any processContents="lax" maxOccurs="unbounded"/></xs:sequence><xs:anyAttribute/></xs:complexType></xs:element>`);
        expect(
            createParser(schema)(
                `<holder x="1"><known>5</known><other a="1"><inner>2</inner></other></holder>`,
            ),
        ).toEqual({ x: '1', known: 5, other: { a: 1, inner: 2 } });
    });

    it('can keep, drop or reject unknown content', () => {
        const schema = schemaOf(
            `<xs:element name="r"><xs:complexType><xs:sequence>${el(
                'a',
            )}</xs:sequence></xs:complexType></xs:element>`,
        );
        const xml = `<r extra="1"><a>x</a><z>1</z></r>`;
        expect(createParser(schema)(xml)).toEqual({ a: 'x', extra: '1', z: 1 });
        expect(createParser(schema, { unknown: 'ignore' })(xml)).toEqual({
            a: 'x',
        });
        expect(() => createParser(schema, { unknown: 'error' })(xml)).toThrow(
            /not allowed/,
        );
        expect(() =>
            createParser(schema, { unknown: 'error' })(`<q/>`),
        ).toThrow(/not declared/);
        expect(createParser(schema)(`<q><a>1</a></q>`)).toEqual({ a: 1 });
    });

    it('rejects malformed XML with a position', () => {
        const parseDoc = createParser(schemaOf(el('a')));
        expect(() => parseDoc('<a>text')).toThrow(/Malformed XML at line 1/);
        expect(() => parseDoc('<a></b>')).toThrow(/Malformed XML/);
    });

    it('compiles the schema once per parser', () => {
        const schema = schemaOf(el('a', 'xs:int'));
        const parseDoc = createParser(schema);
        expect(parseDoc('<a>1</a>')).toBe(1);
        expect(parseDoc('<a>2</a>')).toBe(2);
    });
});

describe('schema-less parsing', () => {
    it('merges attributes and children, makes repeats arrays and coerces JSON-like text', () => {
        const parsed =
            parse(`<?xml version="1.0"?><!DOCTYPE r><!-- c --><r id="7" ok="true">
            <n>1.5</n><s>007</s><list>a</list><list>b</list><e/><obj k="v">text</obj></r>`);
        expect(parsed).toEqual({
            id: 7,
            ok: true,
            n: 1.5,
            s: '007',
            list: ['a', 'b'],
            e: '',
            obj: { k: 'v', obj: 'text' },
        });
        expect(createParser()('<a>5</a>')).toBe(5);
    });
});

describe('round trips', () => {
    it('parse(build(x)) gives x back', () => {
        const body = `
            <xs:simpleType name="level"><xs:restriction base="xs:string"><xs:enumeration value="low"/><xs:enumeration value="high"/></xs:restriction></xs:simpleType>
            <xs:element name="order"><xs:complexType><xs:sequence>
                <xs:element name="line" maxOccurs="unbounded"><xs:complexType><xs:sequence>
                    ${el('sku')}${el('qty', 'xs:int')}${el(
            'note',
            'xs:string',
            'minOccurs="0"',
        )}
                </xs:sequence><xs:attribute name="level" type="level"/></xs:complexType></xs:element>
                <xs:element name="total"><xs:complexType><xs:simpleContent><xs:extension base="xs:decimal"><xs:attribute name="cur" type="xs:string" use="required"/></xs:extension></xs:simpleContent></xs:complexType></xs:element>
                <xs:choice><xs:element name="pickup" type="xs:boolean"/><xs:element name="ship" type="xs:string"/></xs:choice>
            </xs:sequence><xs:attribute name="id" type="xs:long" use="required"/></xs:complexType></xs:element>`;
        const data = {
            id: 12345,
            line: [
                { sku: 'a', qty: 1, level: 'low' },
                { sku: 'b', qty: 2, note: 'fragile', level: 'high' },
            ],
            total: { cur: 'EUR', total: 12.5 },
            ship: 'DHL',
        };
        for (const attrs of [
            '',
            'targetNamespace="urn:o"',
            'targetNamespace="urn:o" elementFormDefault="qualified"',
        ]) {
            const { parsed } = roundTrip(body, 'order', data, attrs);
            expect(parsed).toEqual(data);
        }
    });
});
