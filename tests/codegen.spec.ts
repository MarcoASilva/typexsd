import { describe, expect, it } from 'vitest';
import { generate, schemaXml, typecheck } from './helpers';
import { loadSchemaSync } from '../src/schema';
import { generateTypes } from '../src/codegen';

const el = (n: string, type = 'xs:string', attrs = '') =>
    `<xs:element name="${n}" type="${type}" ${attrs}/>`;

/** Generate, check that the output compiles under strict TypeScript, return it. */
const ts = (body: string, attrs?: string, options = {}): string => {
    const source = generate(body, { attrs }, options);
    expect(typecheck(source)).toEqual([]);
    return source;
};

describe('cardinality', () => {
    it('maps minOccurs/maxOccurs to optional properties and arrays', () => {
        expect(
            ts(`<xs:element name="root"><xs:complexType><xs:sequence>
                ${el('required')}
                ${el('optional', 'xs:int', 'minOccurs="0"')}
                ${el('list', 'xs:boolean', 'maxOccurs="unbounded"')}
                ${el('bounded', 'xs:string', 'minOccurs="2" maxOccurs="5"')}
            </xs:sequence></xs:complexType></xs:element>`),
        ).toMatchInlineSnapshot(`
          "/**
           * Global elements of the schema, keyed by element name.
           */
          export interface Schema {
              root?: Root;
          }
          export interface Root {
              required: string;
              optional?: number;
              list: boolean[];
              /**
               * @minItems 2
               * @maxItems 5
               */
              bounded: string[];
          }
          "
        `);
    });

    it('inherits maxOccurs from sequence, choice and group particles', () => {
        const out = ts(`
            <xs:group name="g"><xs:sequence>${el('g1')}${el(
            'g2',
        )}</xs:sequence></xs:group>
            <xs:complexType name="t"><xs:sequence>
              <xs:sequence maxOccurs="unbounded">${el('s1')}${el(
            's2',
            'xs:string',
            'minOccurs="0"',
        )}</xs:sequence>
              <xs:group ref="g" maxOccurs="3" minOccurs="0"/>
            </xs:sequence></xs:complexType>`);
        expect(out).toContain('s1: string[];');
        expect(out).toContain('s2?: string[];');
        expect(out).toContain('g1?: string[];');
        expect(out).toContain('g2?: string[];');
        expect(out).toContain('@maxItems 3');
    });
});

describe('choices', () => {
    it('maps a choice to a union of branches', () => {
        expect(
            ts(
                `<xs:complexType name="t"><xs:choice>${el(
                    'a',
                )}<xs:sequence>${el('b')}${el(
                    'c',
                    'xs:int',
                    'minOccurs="0"',
                )}</xs:sequence></xs:choice></xs:complexType>`,
            ),
        ).toMatchInlineSnapshot(`
          "/**
           * Global elements of the schema, keyed by element name.
           */
          export interface Schema {
          }
          export type T = {
              a: string;
          } | {
              b: string;
              c?: number;
          };
          "
        `);
    });

    it('adds an empty alternative for choice minOccurs="0" (known issue #001)', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:choice minOccurs="0">${el('a')}${el(
                'b',
            )}</xs:choice></xs:complexType>`,
        );
        expect(out).toMatch(
            /export type T = \{\s*a: string;\s*\} \| \{\s*b: string;\s*\} \| \{\};/,
        );
    });

    it('makes a repeating choice a set of optional arrays', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:choice maxOccurs="unbounded">${el(
                'a',
            )}${el('b', 'xs:int')}</xs:choice></xs:complexType>`,
        );
        expect(out).toMatch(
            /export interface T \{\s*a\?: string\[\];\s*b\?: number\[\];\s*\}/,
        );
    });

    it('does not multiply branches for several or nested choices', () => {
        const choice = (p: string) =>
            `<xs:choice>${[1, 2, 3, 4]
                .map(i => el(`${p}${i}`))
                .join('')}</xs:choice>`;
        const out = ts(
            `<xs:complexType name="t"><xs:sequence>${choice('a')}${choice(
                'b',
            )}${choice('c')}${choice('d')}</xs:sequence></xs:complexType>`,
        );
        // 4 choices x 4 branches stay 16 alternatives, not 4^4 = 256
        expect(out.match(/^\s+[a-d][1-4]: string;$/gm)).toHaveLength(16);
        expect(out.match(/\) & \(/g)).toHaveLength(3);
    });

    it('supports choices nested in choices', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:choice>${el('a')}<xs:sequence>${el(
                'b',
            )}<xs:choice>${el('c')}${el(
                'd',
            )}</xs:choice></xs:sequence></xs:choice></xs:complexType>`,
        );
        expect(out).toMatch(
            /b: string;\s*\} & \(\{\s*c: string;\s*\} \| \{\s*d: string;\s*\}\)/,
        );
    });

    it('keeps fixed members in front of the choices', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:sequence>${el('x')}<xs:choice>${el(
                'a',
            )}${el('b')}</xs:choice>${el(
                'y',
                'xs:string',
                'minOccurs="0"',
            )}</xs:sequence></xs:complexType>`,
        );
        expect(out).toMatch(
            /export type T = \{\s*x: string;\s*y\?: string;\s*\} & \(\{\s*a: string;\s*\} \| \{\s*b: string;\s*\}\);/,
        );
    });

    it('makes everything under an optional ancestor optional', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:sequence minOccurs="0">${el('a')}${el(
                'b',
            )}</xs:sequence></xs:complexType>`,
        );
        expect(out).toMatch(/a\?: string;\s*b\?: string;/);
    });
});

describe('simple types', () => {
    it('maps enumerations to literal unions, numbers and booleans to literal types', () => {
        const out = ts(`
            <xs:simpleType name="color"><xs:restriction base="xs:string"><xs:enumeration value="red"/><xs:enumeration value="green"/></xs:restriction></xs:simpleType>
            <xs:simpleType name="size"><xs:restriction base="xs:int"><xs:enumeration value="1"/><xs:enumeration value="-2"/></xs:restriction></xs:simpleType>
            <xs:simpleType name="flag"><xs:restriction base="xs:boolean"><xs:enumeration value="true"/></xs:restriction></xs:simpleType>
            <xs:simpleType name="padded"><xs:restriction base="xs:token"><xs:enumeration value="  a   b "/></xs:restriction></xs:simpleType>`);
        expect(out).toContain("export type Color = 'red' | 'green';");
        expect(out).toContain('export type Size = 1 | -2;');
        expect(out).toContain('export type Flag = true;');
        expect(out).toContain("export type Padded = 'a b';");
    });

    it('keeps names of simple types as aliases and documents facets', () => {
        const out = ts(`
            <xs:simpleType name="zip"><xs:restriction base="xs:string"><xs:pattern value="[0-9]{5}"/><xs:minLength value="5"/><xs:maxLength value="5"/></xs:restriction></xs:simpleType>
            <xs:simpleType name="pct"><xs:restriction base="xs:decimal"><xs:minInclusive value="0"/><xs:maxExclusive value="100"/><xs:fractionDigits value="2"/><xs:totalDigits value="5"/></xs:restriction></xs:simpleType>
            <xs:complexType name="t"><xs:sequence><xs:element name="zip" type="zip"/><xs:element name="p" type="pct"/></xs:sequence></xs:complexType>`);
        expect(out).toContain('@pattern [0-9]{5}');
        expect(out).toContain('@minLength 5');
        expect(out).toMatch(/@minimum 0/);
        expect(out).toMatch(/@exclusiveMaximum 100/);
        expect(out).toMatch(/@fractionDigits 2/);
        expect(out).toContain('export type Zip = string;');
        expect(out).toContain('export type Pct = number;');
        expect(out).toContain('zip: Zip;');
    });

    it('maps lists to arrays and unions to unions', () => {
        const out = ts(`
            <xs:simpleType name="ids"><xs:list itemType="xs:int"/></xs:simpleType>
            <xs:simpleType name="mode"><xs:restriction base="xs:string"><xs:enumeration value="a"/><xs:enumeration value="b"/></xs:restriction></xs:simpleType>
            <xs:simpleType name="modes"><xs:list itemType="mode"/></xs:simpleType>
            <xs:simpleType name="u"><xs:union memberTypes="xs:int mode"/></xs:simpleType>`);
        expect(out).toContain('export type Ids = number[];');
        expect(out).toContain('export type Modes = Mode[];');
        expect(out).toContain('export type U = number | Mode;');
    });

    it('maps every built-in datatype family', () => {
        const names = [
            'string',
            'normalizedString',
            'token',
            'language',
            'Name',
            'NCName',
            'ID',
            'IDREF',
            'ENTITY',
            'NMTOKEN',
            'anyURI',
            'QName',
            'NOTATION',
            'duration',
            'dateTime',
            'date',
            'time',
            'gYear',
            'gYearMonth',
            'gMonth',
            'gDay',
            'gMonthDay',
            'boolean',
            'decimal',
            'integer',
            'long',
            'int',
            'short',
            'byte',
            'nonNegativeInteger',
            'positiveInteger',
            'negativeInteger',
            'nonPositiveInteger',
            'unsignedLong',
            'unsignedInt',
            'unsignedShort',
            'unsignedByte',
            'float',
            'double',
            'hexBinary',
            'base64Binary',
            'NMTOKENS',
            'IDREFS',
            'ENTITIES',
            'anySimpleType',
        ];
        const out = ts(
            `<xs:complexType name="t"><xs:sequence>${names
                .map(n => el(`v_${n}`, `xs:${n}`))
                .join('')}</xs:sequence></xs:complexType>`,
        );
        const kind = (n: string) =>
            new RegExp(`v_${n}: ([^;]+);`).exec(out)![1];
        for (const n of [
            'string',
            'token',
            'ID',
            'anyURI',
            'QName',
            'dateTime',
            'date',
            'duration',
            'gYear',
            'anySimpleType',
        ])
            expect(kind(n)).toBe('string');
        for (const n of [
            'decimal',
            'integer',
            'long',
            'int',
            'short',
            'byte',
            'unsignedLong',
            'positiveInteger',
            'float',
            'double',
        ])
            expect(kind(n)).toBe('number');
        expect(kind('boolean')).toBe('boolean');
        expect(kind('hexBinary')).toBe('Buffer');
        expect(kind('base64Binary')).toBe('Buffer');
        expect(kind('NMTOKENS')).toBe('string[]');
    });

    it('honors a typeMap override for built-in types', () => {
        const out = generate(
            `<xs:complexType name="t"><xs:sequence>${el(
                'when',
                'xs:dateTime',
            )}${el('day', 'xs:date')}${el(
                'blob',
                'xs:base64Binary',
            )}</xs:sequence></xs:complexType>`,
            {},
            { typeMap: { dateTime: 'Date', base64Binary: 'Uint8Array' } },
        );
        expect(out).toContain('when: Date;');
        expect(out).toContain('day: string;');
        expect(out).toContain('blob: Uint8Array;');
        expect(() =>
            generate(
                `<xs:element name="a" type="xs:string"/>`,
                {},
                { typeMap: { string: 'a | b' } },
            ),
        ).toThrow(/typeMap/);
    });
});

describe('attributes', () => {
    it('maps use, enumerations, fixed and default values', () => {
        const out = ts(`<xs:complexType name="t">
            <xs:attribute name="req" type="xs:string" use="required"/>
            <xs:attribute name="opt" type="xs:int"/>
            <xs:attribute name="proh" type="xs:int" use="prohibited"/>
            <xs:attribute name="fx" type="xs:string" fixed="1.0"/>
            <xs:attribute name="fxn" type="xs:int" fixed="7"/>
            <xs:attribute name="dflt" type="xs:string" default="x"/>
            <xs:attribute name="kind"><xs:simpleType><xs:restriction base="xs:string"><xs:enumeration value="a"/><xs:enumeration value="b"/></xs:restriction></xs:simpleType></xs:attribute>
            <xs:attribute name="tags" type="xs:NMTOKENS"/>
        </xs:complexType>`);
        expect(out).toContain('req: string;');
        expect(out).toContain('opt?: number;');
        expect(out).not.toContain('proh');
        expect(out).toContain("fx?: '1.0';");
        expect(out).toContain('fxn?: 7;');
        expect(out).toContain('@default "x"');
        expect(out).toContain("kind?: 'a' | 'b';");
        expect(out).toContain('tags?: string[];');
    });

    it('quotes property names that are not identifiers', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:sequence>${el(
                'verse-num',
            )}</xs:sequence><xs:attribute name="begin-chapter" type="xs:int"/></xs:complexType>`,
        );
        expect(out).toContain("'verse-num': string;");
        expect(out).toContain("'begin-chapter'?: number;");
    });
});

describe('derivation', () => {
    it('maps extension to interface inheritance', () => {
        const out = ts(`
            <xs:complexType name="base"><xs:sequence>${el(
                'a',
            )}</xs:sequence><xs:attribute name="id" type="xs:string"/></xs:complexType>
            <xs:complexType name="derived"><xs:complexContent><xs:extension base="base"><xs:sequence>${el(
                'b',
                'xs:int',
            )}</xs:sequence><xs:attribute name="extra" type="xs:string"/></xs:extension></xs:complexContent></xs:complexType>`);
        expect(out).toMatch(
            /export interface Derived extends Base \{\s*extra\?: string;\s*b: number;\s*\}/,
        );
        expect(out).toMatch(
            /export interface Base \{\s*id\?: string;\s*a: string;\s*\}/,
        );
    });

    it('falls back to an intersection when the base has choices', () => {
        const out = ts(`
            <xs:complexType name="base"><xs:choice>${el('a')}${el(
            'b',
        )}</xs:choice></xs:complexType>
            <xs:complexType name="derived"><xs:complexContent><xs:extension base="base"><xs:sequence>${el(
                'c',
            )}</xs:sequence></xs:extension></xs:complexContent></xs:complexType>`);
        expect(out).toMatch(
            /export type Derived = Base & \{\s*c: string;\s*\};/,
        );
    });

    it('does not inherit on restriction (the content may be narrowed)', () => {
        const out = ts(`
            <xs:complexType name="base"><xs:sequence>${el('a')}${el(
            'b',
        )}</xs:sequence></xs:complexType>
            <xs:complexType name="narrow"><xs:complexContent><xs:restriction base="base"><xs:sequence>${el(
                'a',
            )}${el(
            'b',
            'xs:string',
            'minOccurs="0"',
        )}</xs:sequence></xs:restriction></xs:complexContent></xs:complexType>`);
        expect(out).toMatch(
            /export interface Narrow \{\s*a: string;\s*b\?: string;\s*\}/,
        );
    });
});

describe('text content under the flat convention', () => {
    it('puts simple content under a property named after the element (issue #002)', () => {
        const out =
            ts(`<xs:element name="price"><xs:complexType><xs:simpleContent><xs:extension base="xs:decimal">
            <xs:attribute name="currency" type="xs:string" use="required"/></xs:extension></xs:simpleContent></xs:complexType></xs:element>`);
        expect(out).toMatch(
            /export interface Price \{\s*currency: string;\s*price: number;\s*\}/,
        );
        expect(out).toContain('price?: Price;');
    });

    it('uses the bare value when simple content has no attributes', () => {
        const out = ts(`
            <xs:complexType name="plain"><xs:simpleContent><xs:extension base="xs:int"/></xs:simpleContent></xs:complexType>
            <xs:element name="n" type="plain"/>`);
        expect(out).toContain('export type Plain = number;');
        expect(out).toContain('n?: Plain;');
    });

    it('folds the text into types used by one element name and intersects for shared ones', () => {
        const out = ts(`
            <xs:complexType name="note" mixed="true"><xs:sequence minOccurs="0">${el(
                'b',
            )}</xs:sequence></xs:complexType>
            <xs:complexType name="tag"><xs:simpleContent><xs:extension base="xs:string"><xs:attribute name="k" type="xs:string"/></xs:extension></xs:simpleContent></xs:complexType>
            <xs:element name="memo" type="note"/>
            <xs:element name="first" type="tag"/>
            <xs:element name="second" type="tag"/>`);
        expect(out).toMatch(
            /export interface Note \{\s*b\?: string;\s*memo\?: string;\s*\}/,
        );
        expect(out).toMatch(/export interface Tag \{\s*k\?: string;\s*\}/);
        expect(out).toContain('first?: Tag & {');
        expect(out).toContain('second?: Tag & {');
    });

    it('does not fold text into a type that other types extend', () => {
        const out = ts(`
            <xs:complexType name="base"><xs:simpleContent><xs:extension base="xs:string"><xs:attribute name="a" type="xs:string"/></xs:extension></xs:simpleContent></xs:complexType>
            <xs:complexType name="sub"><xs:simpleContent><xs:extension base="base"><xs:attribute name="b" type="xs:string"/></xs:extension></xs:simpleContent></xs:complexType>
            <xs:element name="x" type="base"/><xs:element name="y" type="sub"/>`);
        // `base` is extended, so its users attach the text key themselves;
        // `sub` is used by a single element name and carries it
        expect(out).toContain('x?: Base & {');
        expect(out).toMatch(
            /export interface Sub extends Base \{\s*b\?: string;\s*y: string;\s*\}/,
        );
        expect(out).toContain('y?: Sub;');
    });

    it('avoids clashes between the text property and attributes or children', () => {
        const out = ts(
            `<xs:element name="v"><xs:complexType mixed="true"><xs:sequence minOccurs="0">${el(
                'v',
            )}</xs:sequence></xs:complexType></xs:element>`,
        );
        expect(out).toContain('v_text?: string;');
    });

    it('handles mixed content with children', () => {
        const out = ts(
            `<xs:element name="p"><xs:complexType mixed="true"><xs:choice minOccurs="0" maxOccurs="unbounded">${el(
                'b',
            )}${el('i')}</xs:choice></xs:complexType></xs:element>`,
        );
        expect(out).toMatch(
            /export interface P \{\s*b\?: string\[\];\s*i\?: string\[\];\s*p\?: string;\s*\}/,
        );
    });
});

describe('wildcards, nillable, fixed, substitution groups', () => {
    it('maps xs:any and xs:anyAttribute to index signatures', () => {
        const out = ts(
            `<xs:element name="any"><xs:complexType mixed="true"><xs:sequence minOccurs="0" maxOccurs="unbounded"><xs:any processContents="lax"/></xs:sequence><xs:attribute name="id" type="xs:string"/><xs:anyAttribute/></xs:complexType></xs:element>`,
        );
        expect(out).toMatch(
            /export interface Any \{\s*id\?: string;\s*any\?: string;\s*\[key: string\]: unknown;\s*\}/,
        );
    });

    it('maps xs:anyType to unknown', () => {
        expect(
            ts(
                `<xs:element name="a"/><xs:element name="b" type="xs:anyType"/>`,
            ),
        ).toMatch(/a\?: unknown;\s*b\?: unknown;/);
    });

    it('adds null for nillable elements', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:sequence>${el(
                'n',
                'xs:int',
                'nillable="true"',
            )}</xs:sequence></xs:complexType>`,
        );
        expect(out).toContain('n: number | null;');
    });

    it('turns fixed values into literal types', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:sequence>${el(
                'v',
                'xs:string',
                'fixed="abc"',
            )}${el('n', 'xs:int', 'fixed="3"')}</xs:sequence></xs:complexType>`,
        );
        expect(out).toContain("v: 'abc';");
        expect(out).toContain('n: 3;');
    });

    it('expands substitution groups into alternatives and leaves out abstract heads', () => {
        const out = ts(`
            <xs:element name="shape" type="xs:string" abstract="true"/>
            <xs:element name="circle" substitutionGroup="shape"/>
            <xs:element name="square" substitutionGroup="shape"/>
            <xs:element name="canvas"><xs:complexType><xs:sequence><xs:element ref="shape" maxOccurs="unbounded"/></xs:sequence></xs:complexType></xs:element>`);
        expect(out).not.toMatch(/^\s+shape\??:/m);
        expect(out).toMatch(
            /export interface Canvas \{\s*circle\?: string\[\];\s*square\?: string\[\];\s*\}/,
        );
        const single = ts(`
            <xs:element name="shape" type="xs:string" abstract="true"/>
            <xs:element name="circle" substitutionGroup="shape"/>
            <xs:element name="square" substitutionGroup="shape"/>
            <xs:complexType name="one"><xs:sequence><xs:element ref="shape"/></xs:sequence></xs:complexType>`);
        expect(single).toMatch(
            /export type One = \{\s*circle: string;\s*\} \| \{\s*square: string;\s*\};/,
        );
    });
});

describe('naming', () => {
    it('gives anonymous types of same-named local elements distinct names', () => {
        const local = (inner: string) =>
            `<xs:element name="item"><xs:complexType><xs:sequence>${el(
                inner,
            )}</xs:sequence></xs:complexType></xs:element>`;
        const out = ts(`
            <xs:element name="a"><xs:complexType><xs:sequence>${local(
                'x',
            )}</xs:sequence></xs:complexType></xs:element>
            <xs:element name="b"><xs:complexType><xs:sequence>${local(
                'y',
            )}</xs:sequence></xs:complexType></xs:element>`);
        expect(out).toMatch(
            /export interface (AItem|Item) \{\s*x: string;\s*\}/,
        );
        expect(out).toMatch(
            /export interface (BItem|Item2) \{\s*y: string;\s*\}/,
        );
    });

    it('keeps element and type of the same name apart, and avoids reserved names', () => {
        const out = ts(`
            <xs:element name="foo" type="foo"/>
            <xs:complexType name="foo"><xs:sequence>${el(
                'bar',
            )}</xs:sequence></xs:complexType>
            <xs:complexType name="buffer"><xs:sequence>${el(
                'x',
            )}</xs:sequence></xs:complexType>
            <xs:complexType name="date"><xs:sequence>${el(
                'y',
            )}</xs:sequence></xs:complexType>
            <xs:complexType name="schema"><xs:sequence>${el(
                'z',
            )}</xs:sequence></xs:complexType>`);
        expect(out).toContain('export interface Foo {');
        expect(out).toContain('foo?: Foo;');
        expect(out).toContain('export interface Buffer2 {');
        expect(out).toContain('export interface Date2 {');
        expect(out).toContain('export interface Schema2 {');
    });

    it('makes identifiers out of odd XML names', () => {
        const out = ts(`
            <xs:complexType name="verse-num_element"><xs:sequence>${el(
                'a',
            )}</xs:sequence></xs:complexType>
            <xs:complexType name="_1st"><xs:sequence>${el(
                'a',
            )}</xs:sequence></xs:complexType>
            <xs:complexType name="a.b-c"><xs:sequence>${el(
                'a',
            )}</xs:sequence></xs:complexType>`);
        expect(out).toContain('export interface VerseNumElement {');
        expect(out).toMatch(/export interface _1\w* \{/);
        expect(out).toContain('export interface ABC {');
    });

    it('lets the root interface be renamed', () => {
        expect(
            generate(
                `<xs:element name="a" type="xs:string"/>`,
                {},
                { rootName: 'Root' },
            ),
        ).toContain('export interface Root {');
    });
});

describe('documentation', () => {
    const doc = `<xs:annotation>
        <xs:documentation>Deutsche Beschreibung</xs:documentation>
        <xs:documentation xml:lang="en">English description</xs:documentation>
        <xs:documentation xml:lang="fr">Description</xs:documentation>
    </xs:annotation>`;

    it('emits TSDoc for the preferred language', () => {
        const out = ts(
            `<xs:complexType name="t"><xs:sequence><xs:element name="a" type="xs:string">${doc}</xs:element></xs:sequence></xs:complexType>`,
        );
        expect(out).toMatch(
            /\/\*\*\s*\* Deutsche Beschreibung\s*\*\s*\* English description\s*\*\/\s*a: string;/,
        );
        expect(out).not.toContain('Description\n');
    });

    it('can prefer another language, fall back to the first, or be turned off', () => {
        const body = `<xs:complexType name="t"><xs:sequence><xs:element name="a" type="xs:string">${doc}</xs:element></xs:sequence></xs:complexType>`;
        expect(generate(body, {}, { docLang: 'fr' })).toContain('Description');
        expect(generate(body, {}, { docLang: 'fr' })).toContain(
            'Deutsche Beschreibung',
        );
        expect(generate(body, {}, { docs: false })).not.toContain('/**');
        const onlyDe = `<xs:element name="a" type="xs:string"><xs:annotation><xs:documentation xml:lang="de">Nur deutsch</xs:documentation></xs:annotation></xs:element>`;
        expect(generate(onlyDe)).toContain('Nur deutsch');
    });

    it('escapes comment terminators', () => {
        const out = generate(
            `<xs:element name="a" type="xs:string"><xs:annotation><xs:documentation>a */ b</xs:documentation></xs:annotation></xs:element>`,
        );
        expect(out).not.toContain('a */ b');
        expect(typecheck(out)).toEqual([]);
    });
});

describe('redefine', () => {
    it('generates the original under a hidden name and the redefinition on top of it', () => {
        const orig = schemaXml(
            `<xs:complexType name="person"><xs:sequence>${el(
                'name',
            )}</xs:sequence></xs:complexType>`,
        );
        const main = schemaXml(
            `<xs:redefine schemaLocation="orig.xsd"><xs:complexType name="person"><xs:complexContent><xs:extension base="person"><xs:sequence>${el(
                'age',
                'xs:int',
            )}</xs:sequence></xs:extension></xs:complexContent></xs:complexType></xs:redefine>`,
        );
        const source = generateTypes(
            loadSchemaSync(
                { location: 'main.xsd', text: main },
                { sources: { 'orig.xsd': orig } },
            ),
            { header: false },
        );
        expect(typecheck(source)).toEqual([]);
        expect(source).toMatch(
            /export interface PersonOriginal\d+ \{\s*name: string;\s*\}/,
        );
        expect(source).toMatch(
            /export interface Person extends PersonOriginal\d+ \{\s*age: number;\s*\}/,
        );
    });
});

describe('notes from the old todo list and edge cases', () => {
    it('1. arrays for maxOccurs="unbounded"', () => {
        expect(
            ts(
                `<xs:complexType name="t"><xs:sequence>${el(
                    'a',
                    'xs:string',
                    'maxOccurs="unbounded"',
                )}</xs:sequence></xs:complexType>`,
            ),
        ).toContain('a: string[];');
    });

    it('2. optional choices get an alternative without any of the choice props', () => {
        expect(
            ts(
                `<xs:complexType name="t"><xs:choice minOccurs="0">${el(
                    'a',
                )}${el('b')}</xs:choice></xs:complexType>`,
            ),
        ).toContain('| {};');
    });

    it('3. maxOccurs is inherited from choice, group and sequence', () => {
        const out =
            ts(`<xs:group name="g"><xs:choice maxOccurs="unbounded">${el(
                'x',
            )}${el('y')}</xs:choice></xs:group>
            <xs:complexType name="t"><xs:sequence maxOccurs="unbounded"><xs:group ref="g"/>${el(
                'z',
            )}</xs:sequence></xs:complexType>`);
        expect(out).toMatch(
            /x\?: string\[\];\s*y\?: string\[\];\s*z: string\[\];/,
        );
    });

    it('4. inner choices do not cause combinatorial growth', () => {
        const inner =
            '<xs:choice>' +
            'abcdef'
                .split('')
                .map(c => el(c))
                .join('') +
            '</xs:choice>';
        const out = ts(
            `<xs:complexType name="t"><xs:choice minOccurs="0">${inner}<xs:sequence>${inner.replace(
                /name="(\w)"/g,
                'name="$1$1"',
            )}${inner.replace(
                /name="(\w)"/g,
                'name="$1$1$1"',
            )}</xs:sequence></xs:choice></xs:complexType>`,
        );
        expect(out.split('\n').length).toBeLessThan(80);
    });
});
