import { describe, expect, it } from 'vitest';
import { compile, diagnosticCodes, errorCodes, XS } from './helpers';
import { compileXsd } from '../src/schema';
import { ruleNames } from '../src/xsd/rules';

describe('rule coverage', () => {
    it('has a rule for every XML Schema element (1.0 and 1.1)', () => {
        const expected = [
            'schema',
            'include',
            'import',
            'redefine',
            'override',
            'annotation',
            'appinfo',
            'documentation',
            'element',
            'attribute',
            'attributeGroup',
            'group',
            'complexType',
            'simpleType',
            'notation',
            'sequence',
            'choice',
            'all',
            'any',
            'anyAttribute',
            'complexContent',
            'simpleContent',
            'extension',
            'restriction',
            'list',
            'union',
            'length',
            'minLength',
            'maxLength',
            'pattern',
            'enumeration',
            'whiteSpace',
            'maxInclusive',
            'maxExclusive',
            'minExclusive',
            'minInclusive',
            'totalDigits',
            'fractionDigits',
            'explicitTimezone',
            'assertion',
            'unique',
            'key',
            'keyref',
            'selector',
            'field',
            'openContent',
            'defaultOpenContent',
            'alternative',
            'assert',
        ];
        expect(ruleNames().sort()).toEqual(expected.sort());
    });
});

describe('prefix independence', () => {
    const body = `<ELEMENT name="a"><COMPLEX><SEQ><ELEMENT name="b" type="STRING" maxOccurs="unbounded"/></SEQ></COMPLEX></ELEMENT>`;

    const withPrefix = (prefix: string) => {
        const p = prefix ? `${prefix}:` : '';
        const xml = body
            .replace(/ELEMENT/g, `${p}element`)
            .replace(/COMPLEX/g, `${p}complexType`)
            .replace(/SEQ/g, `${p}sequence`)
            .replace(/STRING/g, `${p}string`);
        const ns = prefix ? `xmlns:${prefix}="${XS}"` : `xmlns="${XS}"`;
        return `<${p}schema ${ns}>${xml}</${p}schema>`;
    };

    it('reads xs:, xsd:, other prefixes and a default namespace the same way', () => {
        const results = ['xs', 'xsd', 'w3c', ''].map(prefix => {
            const s = compileXsd(withPrefix(prefix));
            const b = (s.elements.get('a')!.type as any).particle.term
                .particles[0];
            return {
                errors: errorCodes(s),
                max: b.max,
                type: b.term.type.name.local,
            };
        });
        for (const r of results) expect(r).toEqual(results[0]);
        expect(results[0]).toEqual({
            errors: [],
            max: Infinity,
            type: 'string',
        });
    });
});

describe('element rules', () => {
    it('rejects name and ref together, and neither', () => {
        expect(
            errorCodes(
                compile(`<xs:element name="a" type="xs:string"/>
                    <xs:element name="b"><xs:complexType><xs:sequence>
                        <xs:element name="c" ref="a"/>
                        <xs:element/>
                    </xs:sequence></xs:complexType></xs:element>`),
            ),
        ).toEqual(['element-name-or-ref', 'element-name-or-ref']);
    });

    it('rejects ref combined with type/nillable/inline types', () => {
        const s = compile(`<xs:element name="a" type="xs:string"/>
            <xs:element name="b"><xs:complexType><xs:sequence>
                <xs:element ref="a" type="xs:string" nillable="true"/>
            </xs:sequence></xs:complexType></xs:element>`);
        expect(diagnosticCodes(s)).toContain('attribute-forbidden-with');
    });

    it('rejects default together with fixed, and type with an inline type', () => {
        const s =
            compile(`<xs:element name="a" type="xs:string" default="1" fixed="2">
                <xs:simpleType><xs:restriction base="xs:string"/></xs:simpleType>
            </xs:element>`);
        expect(diagnosticCodes(s)).toEqual(
            expect.arrayContaining([
                'attribute-exclusive',
                'element-type-and-inline',
            ]),
        );
    });

    it('limits occurrence attributes to local declarations and abstract/substitutionGroup to global ones', () => {
        const s = compile(`<xs:element name="a" type="xs:string" minOccurs="0"/>
            <xs:element name="b"><xs:complexType><xs:sequence>
                <xs:element name="c" type="xs:string" abstract="true"/>
            </xs:sequence></xs:complexType></xs:element>`);
        expect(diagnosticCodes(s)).toEqual(
            expect.arrayContaining([
                'attribute-local-only',
                'attribute-global-only',
            ]),
        );
    });

    it('rejects minOccurs greater than maxOccurs and malformed values', () => {
        const s = compile(`<xs:element name="b"><xs:complexType><xs:sequence>
                <xs:element name="c" type="xs:string" minOccurs="3" maxOccurs="2"/>
                <xs:element name="d" type="xs:string" minOccurs="x"/>
                <xs:element name="e" type="xs:string" maxOccurs="many"/>
            </xs:sequence></xs:complexType></xs:element>`);
        expect(errorCodes(s).filter(c => c === 'invalid-occurs')).toHaveLength(
            1,
        );
        expect(
            errorCodes(s).filter(c => c === 'invalid-attribute-value'),
        ).toHaveLength(2);
    });

    it('applies defaults: minOccurs/maxOccurs 1, nillable/abstract false', () => {
        const s = compile(`<xs:element name="a"><xs:complexType><xs:sequence>
            <xs:element name="b" type="xs:string"/></xs:sequence></xs:complexType></xs:element>`);
        const a = s.elements.get('a')!;
        const b = (a.type as any).particle.term.particles[0];
        expect([b.min, b.max, b.term.nillable, b.term.abstract]).toEqual([
            1,
            1,
            false,
            false,
        ]);
    });

    it('drops particles that can never occur (maxOccurs="0")', () => {
        const s = compile(`<xs:element name="a"><xs:complexType><xs:sequence>
            <xs:element name="b" type="xs:string"/>
            <xs:element name="c" type="xs:string" minOccurs="0" maxOccurs="0"/>
            </xs:sequence></xs:complexType></xs:element>`);
        expect(
            (s.elements.get('a')!.type as any).particle.term.particles,
        ).toHaveLength(1);
    });
});

describe('attribute rules', () => {
    it('defaults to optional and rejects default with use="required"', () => {
        const s = compile(`<xs:complexType name="t">
            <xs:attribute name="a" type="xs:string"/>
            <xs:attribute name="b" type="xs:string" use="required" default="x"/>
        </xs:complexType>`);
        expect(diagnosticCodes(s)).toEqual(['attribute-default-use']);
        const t = s.types.get('t') as any;
        expect(
            t.attributes.map((u: any) => [u.decl.name.local, u.use]),
        ).toEqual([
            ['a', 'optional'],
            ['b', 'required'],
        ]);
    });

    it('rejects ref with type, and name with ref', () => {
        const s = compile(`<xs:attribute name="g" type="xs:string"/>
            <xs:complexType name="t">
                <xs:attribute ref="g" type="xs:string"/>
                <xs:attribute name="x" ref="g"/>
            </xs:complexType>`);
        expect(diagnosticCodes(s)).toEqual(
            expect.arrayContaining([
                'attribute-forbidden-with',
                'attribute-name-or-ref',
            ]),
        );
    });

    it('limits use/form/ref to local attributes', () => {
        const s = compile(
            `<xs:attribute name="g" type="xs:string" use="required"/>`,
        );
        expect(diagnosticCodes(s)).toEqual(['attribute-local-only']);
    });

    it('removes use="prohibited" attributes from the effective set', () => {
        const s = compile(`<xs:complexType name="t">
            <xs:attribute name="a" type="xs:string" use="prohibited"/>
            <xs:attribute name="b" type="xs:string"/>
        </xs:complexType>`);
        expect(
            (s.types.get('t') as any).attributes.map(
                (u: any) => u.decl.name.local,
            ),
        ).toEqual(['b']);
    });
});

describe('group and attributeGroup rules', () => {
    it('requires exactly one model group in a group definition and none in a reference', () => {
        const s = compile(`<xs:group name="g"/>
            <xs:group name="h"><xs:sequence/><xs:choice/></xs:group>
            <xs:complexType name="t"><xs:group ref="g"><xs:sequence/></xs:group></xs:complexType>`);
        expect(
            diagnosticCodes(s).filter(c => c === 'group-content'),
        ).toHaveLength(3);
    });

    it('requires name on definitions and ref on references', () => {
        const s = compile(`<xs:group><xs:sequence/></xs:group>
            <xs:attributeGroup/>
            <xs:complexType name="t"><xs:group/><xs:attributeGroup/></xs:complexType>`);
        expect(diagnosticCodes(s)).toEqual(
            expect.arrayContaining([
                'group-name-or-ref',
                'attributegroup-name-or-ref',
            ]),
        );
    });

    it('does not allow content in an attributeGroup reference', () => {
        const s =
            compile(`<xs:attributeGroup name="ag"><xs:attribute name="a" type="xs:string"/></xs:attributeGroup>
            <xs:complexType name="t"><xs:attributeGroup ref="ag"><xs:attribute name="b" type="xs:string"/></xs:attributeGroup></xs:complexType>`);
        expect(diagnosticCodes(s)).toContain('attributegroup-ref-content');
    });
});

describe('particle rules', () => {
    it('limits <all> to maxOccurs 1 and warns about repeating children (XSD 1.1 only)', () => {
        const s = compile(`<xs:complexType name="t"><xs:all maxOccurs="2">
            <xs:element name="a" type="xs:string" maxOccurs="3"/></xs:all></xs:complexType>`);
        expect(diagnosticCodes(s)).toEqual([
            'all-occurs',
            'all-particle-occurs',
        ]);
    });

    it('allows only element/any/group inside <all>', () => {
        const s = compile(
            `<xs:complexType name="t"><xs:all><xs:sequence/></xs:all></xs:complexType>`,
        );
        expect(errorCodes(s)).toEqual(['invalid-content']);
    });

    it('does not allow namespace together with notNamespace on wildcards', () => {
        const s = compile(`<xs:complexType name="t"><xs:sequence>
            <xs:any namespace="##other" notNamespace="urn:x"/></xs:sequence></xs:complexType>`);
        expect(errorCodes(s)).toEqual(['attribute-exclusive']);
    });
});

describe('simple type rules', () => {
    it('requires itemType or an inline type for lists, memberTypes or inline types for unions', () => {
        const s = compile(`<xs:simpleType name="l"><xs:list/></xs:simpleType>
            <xs:simpleType name="u"><xs:union/></xs:simpleType>
            <xs:simpleType name="r"><xs:restriction/></xs:simpleType>`);
        expect(diagnosticCodes(s)).toEqual(
            expect.arrayContaining([
                'list-item-type',
                'union-members',
                'restriction-base',
            ]),
        );
    });

    it('validates facet values', () => {
        const s =
            compile(`<xs:simpleType name="t"><xs:restriction base="xs:string">
            <xs:minLength value="-1"/>
            <xs:totalDigits value="0"/>
            <xs:whiteSpace value="squeeze"/>
        </xs:restriction></xs:simpleType>`);
        expect(
            diagnosticCodes(s).filter(c => c === 'facet-value'),
        ).toHaveLength(3);
    });

    it('warns about facets that do not apply to the base type', () => {
        const s =
            compile(`<xs:simpleType name="t"><xs:restriction base="xs:boolean">
            <xs:minLength value="1"/></xs:restriction></xs:simpleType>
            <xs:simpleType name="u"><xs:restriction base="xs:string">
            <xs:fractionDigits value="1"/></xs:restriction></xs:simpleType>`);
        expect(diagnosticCodes(s)).toEqual([
            'facet-not-applicable',
            'facet-not-applicable',
        ]);
    });

    it('requires name on top-level types and rejects it on local ones', () => {
        const s =
            compile(`<xs:simpleType><xs:restriction base="xs:string"/></xs:simpleType>
            <xs:element name="a"><xs:simpleType name="x"><xs:restriction base="xs:string"/></xs:simpleType></xs:element>`);
        expect(diagnosticCodes(s)).toEqual(
            expect.arrayContaining(['name-required', 'attribute-global-only']),
        );
    });
});

describe('document structure rules', () => {
    it('reports unknown elements, misplaced children and missing attributes', () => {
        const s = compile(`<xs:bogus/>
            <xs:include/>
            <xs:complexType name="t"><xs:attribute name="a" type="xs:string"/><xs:sequence/></xs:complexType>`);
        expect(diagnosticCodes(s)).toEqual(
            expect.arrayContaining([
                'unknown-element',
                'missing-attribute',
                'invalid-content',
            ]),
        );
    });

    it('warns about foreign elements and unknown attributes but keeps going', () => {
        const s = compile(
            `<x:thing xmlns:x="urn:x"/><xs:element name="a" type="xs:string" weird="1"/>`,
        );
        expect(diagnosticCodes(s)).toEqual([
            'foreign-element',
            'unknown-attribute',
        ]);
        expect(s.elements.has('a')).toBe(true);
    });

    it('requires <annotation> first and allows documentation/appinfo content', () => {
        const s = compile(`<xs:element name="a" type="xs:string">
            <xs:annotation><xs:documentation xml:lang="en">Hi <b>there</b></xs:documentation><xs:appinfo><any/></xs:appinfo></xs:annotation>
        </xs:element>`);
        expect(errorCodes(s)).toEqual([]);
        expect(s.elements.get('a')!.annotation!.documentation[0]).toMatchObject(
            {
                lang: 'en',
                text: 'Hi there',
            },
        );
    });

    it('rejects documents that are not schemas', () => {
        expect(() => compileXsd('<foo/>', { strict: true })).toThrow(
            /not-a-schema|Could not load/,
        );
    });

    it('rejects malformed XML with a readable error', () => {
        expect(() =>
            compileXsd('<xs:schema xmlns:xs="' + XS + '"><xs:element'),
        ).toThrow(/Malformed XML|schema-malformed/);
    });

    it('strict mode throws an XsdError listing the problems', () => {
        expect(() =>
            compileXsd(
                `<xs:schema xmlns:xs="${XS}"><xs:element name="a" type="nope"/></xs:schema>`,
                { strict: true },
            ),
        ).toThrow(/unresolved-reference/);
    });
});

describe('identity constraints and XSD 1.1 constructs', () => {
    it('keeps unique/key/keyref as metadata', () => {
        const s = compile(`<xs:element name="root"><xs:complexType><xs:sequence>
            <xs:element name="item" maxOccurs="unbounded"><xs:complexType><xs:attribute name="id" type="xs:string"/></xs:complexType></xs:element>
            </xs:sequence></xs:complexType>
            <xs:key name="k"><xs:selector xpath="item"/><xs:field xpath="@id"/></xs:key>
            <xs:keyref name="r" refer="k"><xs:selector xpath="item"/><xs:field xpath="@id"/></xs:keyref>
        </xs:element>`);
        expect(errorCodes(s)).toEqual([]);
        expect(
            s.elements
                .get('root')!
                .identity.map(i => [i.kind, i.name, i.selector, i.fields]),
        ).toEqual([
            ['key', 'k', 'item', ['@id']],
            ['keyref', 'r', 'item', ['@id']],
        ]);
    });

    it('requires keyref to name its key', () => {
        const s = compile(`<xs:element name="root" type="xs:string">
            <xs:keyref name="r"><xs:selector xpath="a"/><xs:field xpath="@b"/></xs:keyref></xs:element>`);
        expect(diagnosticCodes(s)).toContain('missing-attribute');
    });

    it('accepts openContent, assert, alternative and explicitTimezone', () => {
        const s = compile(`<xs:complexType name="t">
                <xs:openContent mode="suffix"><xs:any namespace="##other"/></xs:openContent>
                <xs:sequence><xs:element name="a" type="xs:string"/></xs:sequence>
                <xs:assert test="a != ''"/>
            </xs:complexType>
            <xs:simpleType name="d"><xs:restriction base="xs:dateTime"><xs:explicitTimezone value="required"/></xs:restriction></xs:simpleType>
            <xs:element name="e" type="t"><xs:alternative test="@x" type="xs:string"/></xs:element>`);
        expect(errorCodes(s)).toEqual([]);
        const t = s.types.get('t') as any;
        expect(t.assertions).toEqual(["a != ''"]);
        expect(t.openContent.mode).toBe('suffix');
        expect((s.types.get('d') as any).facets.explicitTimezone).toBe(
            'required',
        );
        expect(s.elements.get('e')!.alternatives).toHaveLength(1);
    });

    it('applies defaultOpenContent', () => {
        const s = compile(
            `<xs:defaultOpenContent><xs:any/></xs:defaultOpenContent>
             <xs:complexType name="t"><xs:sequence><xs:element name="a" type="xs:string"/></xs:sequence></xs:complexType>`,
        );
        expect((s.types.get('t') as any).openContent.wildcard.kind).toBe('any');
    });

    it('records notations', () => {
        const s = compile(
            `<xs:notation name="n" public="p"/><xs:notation name="m"/>`,
        );
        expect([...s.notations.keys()]).toEqual(['n', 'm']);
        expect(diagnosticCodes(s)).toEqual(['notation-identifier']);
    });
});
