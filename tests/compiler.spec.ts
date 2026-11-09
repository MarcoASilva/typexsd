import { describe, expect, it } from 'vitest';
import { compile, diagnosticCodes, errorCodes } from './helpers';
import { ComplexTypeDef, SimpleTypeDef } from '../src/xsd/model';
import { BUILTINS } from '../src/xsd/datatypes/builtins';
import { getContentView } from '../src/xsd/view';
import { compileXsd } from '../src/schema';

const complex = (s: ReturnType<typeof compile>, name: string) =>
    s.types.get(name) as ComplexTypeDef;
const simple = (s: ReturnType<typeof compile>, name: string) =>
    s.types.get(name) as SimpleTypeDef;

describe('built-in datatypes', () => {
    it('knows the full XSD 1.0 hierarchy plus 1.1 additions', () => {
        const names = [...BUILTINS.keys()];
        expect(names).toEqual(
            expect.arrayContaining([
                'string',
                'boolean',
                'decimal',
                'float',
                'double',
                'duration',
                'dateTime',
                'time',
                'date',
                'gYearMonth',
                'gYear',
                'gMonthDay',
                'gDay',
                'gMonth',
                'hexBinary',
                'base64Binary',
                'anyURI',
                'QName',
                'NOTATION',
                'normalizedString',
                'token',
                'language',
                'NMTOKEN',
                'NMTOKENS',
                'Name',
                'NCName',
                'ID',
                'IDREF',
                'IDREFS',
                'ENTITY',
                'ENTITIES',
                'integer',
                'nonPositiveInteger',
                'negativeInteger',
                'long',
                'int',
                'short',
                'byte',
                'nonNegativeInteger',
                'unsignedLong',
                'unsignedInt',
                'unsignedShort',
                'unsignedByte',
                'positiveInteger',
                'anySimpleType',
                'anyAtomicType',
                'dateTimeStamp',
                'dayTimeDuration',
                'yearMonthDuration',
            ]),
        );
    });

    it('applies the facets of the built-in derivation chain', () => {
        const s = compile('');
        const byte = s.builtin('byte')!;
        expect(byte.facets.minInclusive).toBe('-128');
        expect(byte.facets.maxInclusive).toBe('127');
        expect(byte.facets.fractionDigits).toBe(0);
        expect(byte.primitive!.name!.local).toBe('decimal');
        expect(s.builtin('positiveInteger')!.facets.minInclusive).toBe('1');
        expect(s.builtin('token')!.facets.whiteSpace).toBe('collapse');
        expect(s.builtin('NMTOKENS')!.variety).toBe('list');
    });

    it('reports unknown built-in types', () => {
        const s = compile(`<xs:element name="a" type="xs:nope"/>`);
        expect(errorCodes(s)).toEqual(['unknown-builtin-type']);
    });
});

describe('references and symbol spaces', () => {
    it('keeps elements, types and groups apart even when they share a name', () => {
        const s = compile(`
            <xs:element name="foo" type="foo"/>
            <xs:complexType name="foo"><xs:sequence><xs:element name="bar" type="xs:string"/></xs:sequence></xs:complexType>
            <xs:group name="foo"><xs:sequence><xs:element name="baz" type="xs:string"/></xs:sequence></xs:group>`);
        expect(errorCodes(s)).toEqual([]);
        expect(s.elements.get('foo')!.type).toBe(s.types.get('foo'));
        expect(s.groups.size).toBe(1);
    });

    it('reports unresolved references and duplicates', () => {
        const s = compile(`
            <xs:element name="a" type="missing"/>
            <xs:element name="a" type="xs:string"/>
            <xs:complexType name="t"><xs:sequence><xs:element ref="nope"/><xs:group ref="nogroup"/></xs:sequence>
              <xs:attributeGroup ref="noag"/><xs:attribute ref="noattr"/></xs:complexType>`);
        expect(errorCodes(s).sort()).toEqual([
            'duplicate-component',
            'unresolved-reference',
            'unresolved-reference',
            'unresolved-reference',
            'unresolved-reference',
            'unresolved-reference',
        ]);
    });

    it('resolves forward references and recursive structures', () => {
        const s = compile(`
            <xs:element name="tree" type="node"/>
            <xs:complexType name="node"><xs:sequence>
                <xs:element name="child" type="node" minOccurs="0" maxOccurs="unbounded"/>
            </xs:sequence></xs:complexType>`);
        expect(errorCodes(s)).toEqual([]);
        const node = complex(s, 'node');
        const child = (node.particle!.term as any).particles[0].term;
        expect(child.type).toBe(node);
    });

    it('supports recursion through anonymous types', () => {
        const s = compile(`<xs:element name="n"><xs:complexType><xs:sequence>
            <xs:element ref="n" minOccurs="0" maxOccurs="unbounded"/></xs:sequence></xs:complexType></xs:element>`);
        expect(errorCodes(s)).toEqual([]);
        expect(
            getContentView(s.elements.get('n')!.type as ComplexTypeDef).shape
                .slots[0].array,
        ).toBe(true);
    });

    it('applies form defaults to local names', () => {
        const unq = compile(
            `<xs:element name="r"><xs:complexType><xs:sequence><xs:element name="c" type="xs:string"/></xs:sequence><xs:attribute name="x" type="xs:string"/></xs:complexType></xs:element>`,
            { attrs: 'targetNamespace="urn:t"' },
        );
        const q = compile(
            `<xs:element name="r"><xs:complexType><xs:sequence><xs:element name="c" type="xs:string"/></xs:sequence><xs:attribute name="x" type="xs:string"/></xs:complexType></xs:element>`,
            {
                attrs: 'targetNamespace="urn:t" elementFormDefault="qualified" attributeFormDefault="qualified"',
            },
        );
        const names = (s: ReturnType<typeof compile>) => {
            const t = s.elements.get('{urn:t}r')!.type as ComplexTypeDef;
            return [
                (t.particle!.term as any).particles[0].term.name.ns,
                t.attributes[0].decl.name.ns,
            ];
        };
        expect(names(unq)).toEqual(['', '']);
        expect(names(q)).toEqual(['urn:t', 'urn:t']);
        expect(unq.elements.get('{urn:t}r')!.name.ns).toBe('urn:t');
    });
});

describe('simple types', () => {
    it('accumulates facets through derivation; patterns AND across steps and OR within one', () => {
        const s = compile(`
            <xs:simpleType name="a"><xs:restriction base="xs:string">
                <xs:minLength value="2"/><xs:maxLength value="10"/>
                <xs:pattern value="[a-z]+"/><xs:pattern value="[0-9]+"/>
            </xs:restriction></xs:simpleType>
            <xs:simpleType name="b"><xs:restriction base="a">
                <xs:maxLength value="5"/><xs:pattern value=".{3}"/>
            </xs:restriction></xs:simpleType>`);
        const b = simple(s, 'b');
        expect(b.facets.minLength).toBe(2);
        expect(b.facets.maxLength).toBe(5);
        expect(b.facets.patterns).toEqual([['[a-z]+', '[0-9]+'], ['.{3}']]);
        expect(b.base).toBe(simple(s, 'a'));
    });

    it('evaluates list and union varieties', () => {
        const s = compile(`
            <xs:simpleType name="ids"><xs:list itemType="xs:integer"/></xs:simpleType>
            <xs:simpleType name="u"><xs:union memberTypes="xs:integer xs:boolean"><xs:simpleType><xs:restriction base="xs:string"><xs:enumeration value="x"/></xs:restriction></xs:simpleType></xs:union></xs:simpleType>`);
        const ids = simple(s, 'ids');
        expect(ids.variety).toBe('list');
        expect(ids.itemType!.name!.local).toBe('integer');
        const u = simple(s, 'u');
        expect(u.variety).toBe('union');
        expect(u.memberTypes).toHaveLength(3);
    });

    it('rejects lists of lists and detects circular definitions', () => {
        const s = compile(`
            <xs:simpleType name="l"><xs:list itemType="xs:NMTOKENS"/></xs:simpleType>
            <xs:simpleType name="a"><xs:restriction base="b"/></xs:simpleType>
            <xs:simpleType name="b"><xs:restriction base="a"/></xs:simpleType>`);
        expect(errorCodes(s)).toEqual(
            expect.arrayContaining(['list-of-list', 'circular-definition']),
        );
    });

    it('warns when a derivation is blocked by final', () => {
        const s = compile(`
            <xs:simpleType name="a" final="restriction"><xs:restriction base="xs:string"/></xs:simpleType>
            <xs:simpleType name="b"><xs:restriction base="a"/></xs:simpleType>`);
        expect(diagnosticCodes(s)).toEqual(['derivation-blocked']);
    });

    it('applies finalDefault', () => {
        const s = compile(
            `<xs:simpleType name="a"><xs:restriction base="xs:string"/></xs:simpleType>
             <xs:simpleType name="b"><xs:restriction base="a"/></xs:simpleType>`,
            { attrs: 'finalDefault="restriction"' },
        );
        expect(diagnosticCodes(s)).toEqual(['derivation-blocked']);
    });
});

describe('complex types', () => {
    const base = `
        <xs:attributeGroup name="common"><xs:attribute name="id" type="xs:ID"/><xs:attribute name="lang" type="xs:language"/></xs:attributeGroup>
        <xs:group name="pair"><xs:sequence><xs:element name="x" type="xs:int"/><xs:element name="y" type="xs:int"/></xs:sequence></xs:group>
        <xs:complexType name="point"><xs:group ref="pair"/><xs:attributeGroup ref="common"/></xs:complexType>`;

    it('expands groups and attribute groups', () => {
        const s = compile(base);
        const point = complex(s, 'point');
        expect(errorCodes(s)).toEqual([]);
        expect(getContentView(point).shape.slots.map(x => x.key)).toEqual([
            'x',
            'y',
        ]);
        expect(point.attributes.map(a => a.decl.name.local)).toEqual([
            'id',
            'lang',
        ]);
        expect((point.particle!.term as any).origin.local).toBe('pair');
    });

    it('merges base content and attributes on extension', () => {
        const s = compile(`${base}
            <xs:complexType name="point3d"><xs:complexContent><xs:extension base="point">
                <xs:sequence><xs:element name="z" type="xs:int"/></xs:sequence>
                <xs:attribute name="label" type="xs:string"/>
            </xs:extension></xs:complexContent></xs:complexType>`);
        const p3 = complex(s, 'point3d');
        expect(getContentView(p3).shape.slots.map(x => x.key)).toEqual([
            'x',
            'y',
            'z',
        ]);
        expect(p3.attributes.map(a => a.decl.name.local)).toEqual([
            'id',
            'lang',
            'label',
        ]);
        expect(p3.ownAttributes.map(a => a.decl.name.local)).toEqual(['label']);
        expect(p3.base).toBe(complex(s, 'point'));
        expect(p3.derivation).toBe('extension');
    });

    it('replaces content on restriction and honors prohibited attributes', () => {
        const s = compile(`${base}
            <xs:complexType name="xonly"><xs:complexContent><xs:restriction base="point">
                <xs:sequence><xs:element name="x" type="xs:int"/><xs:element name="y" type="xs:int" minOccurs="0"/></xs:sequence>
                <xs:attribute name="lang" use="prohibited"/>
            </xs:restriction></xs:complexContent></xs:complexType>`);
        const t = complex(s, 'xonly');
        expect(
            getContentView(t).shape.slots.map(x => [x.key, x.optional]),
        ).toEqual([
            ['x', false],
            ['y', true],
        ]);
        expect(t.attributes.map(a => a.decl.name.local)).toEqual(['id']);
    });

    it('handles simple content: extension of a simple type and restriction of a complex one', () => {
        const s = compile(`
            <xs:complexType name="price"><xs:simpleContent><xs:extension base="xs:decimal">
                <xs:attribute name="currency" type="xs:string" use="required"/></xs:extension></xs:simpleContent></xs:complexType>
            <xs:complexType name="smallPrice"><xs:simpleContent><xs:restriction base="price">
                <xs:maxInclusive value="100"/></xs:restriction></xs:simpleContent></xs:complexType>`);
        const price = complex(s, 'price');
        expect(price.contentKind).toBe('simple');
        expect(price.simpleValue!.name!.local).toBe('decimal');
        const small = complex(s, 'smallPrice');
        expect(small.simpleValue!.facets.maxInclusive).toBe('100');
        expect(small.simpleValue!.base!.name!.local).toBe('decimal');
        expect(small.attributes.map(a => a.decl.name.local)).toEqual([
            'currency',
        ]);
    });

    it('computes content kinds', () => {
        const s = compile(`
            <xs:complexType name="empty"/>
            <xs:complexType name="elements"><xs:sequence><xs:element name="a" type="xs:string"/></xs:sequence></xs:complexType>
            <xs:complexType name="mixed" mixed="true"><xs:sequence><xs:element name="a" type="xs:string"/></xs:sequence></xs:complexType>
            <xs:complexType name="textOnly" mixed="true"/>
            <xs:complexType name="mixedExt"><xs:complexContent mixed="true"><xs:extension base="elements"/></xs:complexContent></xs:complexType>`);
        const kinds = Object.fromEntries(
            ['empty', 'elements', 'mixed', 'textOnly', 'mixedExt'].map(n => [
                n,
                complex(s, n).contentKind,
            ]),
        );
        expect(kinds).toEqual({
            empty: 'empty',
            elements: 'elementOnly',
            mixed: 'mixed',
            textOnly: 'mixed',
            mixedExt: 'mixed',
        });
    });

    it('detects circular derivation and bad bases', () => {
        const s = compile(`
            <xs:complexType name="a"><xs:complexContent><xs:extension base="b"/></xs:complexContent></xs:complexType>
            <xs:complexType name="b"><xs:complexContent><xs:extension base="a"/></xs:complexContent></xs:complexType>
            <xs:complexType name="c"><xs:complexContent><xs:extension base="xs:string"/></xs:complexContent></xs:complexType>
            <xs:complexType name="d"><xs:simpleContent><xs:extension base="a"/></xs:simpleContent></xs:complexType>`);
        expect(errorCodes(s)).toEqual(
            expect.arrayContaining([
                'circular-definition',
                'complexcontent-base',
                'simplecontent-base',
            ]),
        );
    });

    it('detects circular groups and attribute groups', () => {
        const s = compile(`
            <xs:group name="g"><xs:sequence><xs:group ref="g"/></xs:sequence></xs:group>
            <xs:attributeGroup name="ag"><xs:attributeGroup ref="ag"/></xs:attributeGroup>`);
        expect(errorCodes(s)).toEqual([
            'circular-definition',
            'circular-definition',
        ]);
    });

    it('reports duplicate attributes', () => {
        const s = compile(`<xs:complexType name="t">
            <xs:attribute name="a" type="xs:string"/><xs:attribute name="a" type="xs:string"/></xs:complexType>`);
        expect(errorCodes(s)).toEqual(['duplicate-attribute']);
    });

    it('applies blockDefault / finalDefault to complex types and elements', () => {
        const s = compile(
            `<xs:complexType name="t"/><xs:element name="e" type="t"/>`,
            { attrs: 'blockDefault="#all" finalDefault="extension"' },
        );
        expect(complex(s, 't').block).toEqual(['extension', 'restriction']);
        expect(complex(s, 't').final).toEqual(['extension']);
        expect(s.elements.get('e')!.block).toEqual([
            'extension',
            'restriction',
            'substitution',
        ]);
    });
});

describe('wildcards', () => {
    it('expands namespace tokens', () => {
        const s = compile(
            `<xs:complexType name="t"><xs:sequence>
            <xs:any namespace="##other" processContents="lax" minOccurs="0"/>
            <xs:any namespace="##local ##targetNamespace urn:x"/>
            <xs:any notNamespace="urn:y"/>
          </xs:sequence><xs:anyAttribute namespace="##local"/></xs:complexType>`,
            { attrs: 'targetNamespace="urn:t"' },
        );
        const t = s.types.get('{urn:t}t') as ComplexTypeDef;
        const terms = (t.particle!.term as any).particles.map(
            (p: any) => p.term.namespace,
        );
        expect(terms).toEqual([
            { kind: 'other', ns: 'urn:t' },
            { kind: 'list', namespaces: ['', 'urn:t', 'urn:x'] },
            { kind: 'not', namespaces: ['urn:y'] },
        ]);
        expect(t.attributeWildcard!.namespace).toEqual({
            kind: 'list',
            namespaces: [''],
        });
    });

    it('intersects attribute wildcards of attribute groups with the declared one', () => {
        const s = compile(`
            <xs:attributeGroup name="g"><xs:anyAttribute namespace="urn:a urn:b"/></xs:attributeGroup>
            <xs:complexType name="t"><xs:attributeGroup ref="g"/><xs:anyAttribute namespace="urn:b urn:c"/></xs:complexType>`);
        expect(complex(s, 't').attributeWildcard!.namespace).toEqual({
            kind: 'list',
            namespaces: ['urn:b'],
        });
    });
});

describe('substitution groups', () => {
    const xsd = `
        <xs:element name="shape" type="xs:string" abstract="true"/>
        <xs:element name="circle" substitutionGroup="shape"/>
        <xs:element name="round" substitutionGroup="circle" type="xs:token"/>
        <xs:element name="square" substitutionGroup="shape"/>`;

    it('computes the transitive closure and inherits the head type', () => {
        const s = compile(xsd);
        const shape = s.elements.get('shape')!;
        expect(shape.substitutes.map(e => e.name.local).sort()).toEqual([
            'circle',
            'round',
            'square',
        ]);
        expect(s.elements.get('circle')!.type).toBe(s.builtin('string'));
        expect(s.elements.get('round')!.type).toBe(s.builtin('token'));
        expect(s.elements.get('circle')!.substitutionGroup).toBe(shape);
    });

    it('reports a missing head', () => {
        const s = compile(`<xs:element name="a" substitutionGroup="nope"/>`);
        expect(errorCodes(s)).toEqual(['unresolved-reference']);
    });
});

describe('effective cardinality (content view)', () => {
    const view = (body: string) => {
        const s = compile(`<xs:complexType name="t">${body}</xs:complexType>`);
        expect(errorCodes(s)).toEqual([]);
        return getContentView(complex(s, 't'));
    };
    const el = (n: string, attrs = '') =>
        `<xs:element name="${n}" type="xs:string" ${attrs}/>`;

    it('multiplies maxOccurs and zeroes minOccurs through nested particles', () => {
        const v = view(
            `<xs:sequence minOccurs="0" maxOccurs="3">${el('a')}${el(
                'b',
                'maxOccurs="2"',
            )}</xs:sequence>`,
        );
        expect(
            v.shape.slots.map(s => [s.key, s.optional, s.array, s.min, s.max]),
        ).toEqual([
            ['a', true, true, 0, 3],
            ['b', true, true, 0, 6],
        ]);
    });

    it('treats a repeated element in one sequence as an array', () => {
        const v = view(
            `<xs:sequence>${el('a')}${el('b')}${el('a')}</xs:sequence>`,
        );
        expect(v.shape.slots.map(s => [s.key, s.array, s.max])).toEqual([
            ['a', true, 2],
            ['b', false, 1],
        ]);
    });

    it('turns a choice into a group of branches, with minOccurs=0 making it optional', () => {
        const v = view(
            `<xs:choice minOccurs="0">${el('a')}<xs:sequence>${el('b')}${el(
                'c',
            )}</xs:sequence></xs:choice>`,
        );
        expect(v.shape.slots).toEqual([]);
        expect(v.shape.choices).toHaveLength(1);
        expect(v.shape.choices[0].optional).toBe(true);
        expect(
            v.shape.choices[0].branches.map(b => b.slots.map(s => s.key)),
        ).toEqual([['a'], ['b', 'c']]);
    });

    it('flattens a repeating choice into optional arrays', () => {
        const v = view(
            `<xs:choice maxOccurs="unbounded">${el('a')}${el('b')}</xs:choice>`,
        );
        expect(v.shape.choices).toEqual([]);
        expect(v.shape.slots.map(s => [s.key, s.optional, s.array])).toEqual([
            ['a', true, true],
            ['b', true, true],
        ]);
    });

    it('keeps several choices independent instead of multiplying branches', () => {
        const v = view(`<xs:sequence>
            <xs:choice>${el('a')}${el('b')}${el('c')}</xs:choice>
            <xs:choice>${el('d')}${el('e')}${el('f')}</xs:choice>
            <xs:choice>${el('g')}${el('h')}${el(
            'i',
        )}</xs:choice></xs:sequence>`);
        expect(v.shape.choices).toHaveLength(3);
        expect(v.shape.choices.every(c => c.branches.length === 3)).toBe(true);
    });

    it('supports nested choices', () => {
        const v = view(
            `<xs:choice>${el('a')}<xs:sequence>${el('b')}<xs:choice>${el(
                'c',
            )}${el('d')}</xs:choice></xs:sequence></xs:choice>`,
        );
        const branch = v.shape.choices[0].branches[1];
        expect(branch.slots.map(s => s.key)).toEqual(['b']);
        expect(branch.choices[0].branches.map(b => b.slots[0].key)).toEqual([
            'c',
            'd',
        ]);
    });

    it('expands substitution groups into alternatives', () => {
        const s = compile(`
            <xs:element name="shape" type="xs:string" abstract="true"/>
            <xs:element name="circle" substitutionGroup="shape"/>
            <xs:element name="square" substitutionGroup="shape"/>
            <xs:complexType name="t"><xs:sequence><xs:element ref="shape"/></xs:sequence></xs:complexType>`);
        const v = getContentView(complex(s, 't'));
        expect(v.shape.choices[0].branches.map(b => b.slots[0].key)).toEqual([
            'circle',
            'square',
        ]);
        expect(v.index.size).toBe(2);
    });

    it('resolves key collisions deterministically', () => {
        const s =
            compile(`<xs:complexType name="t"><xs:sequence><xs:element name="name" type="xs:string"/></xs:sequence>
            <xs:attribute name="name" type="xs:string"/></xs:complexType>`);
        const v = getContentView(complex(s, 't'));
        expect(v.attributes[0].key).toBe('name_attribute');
        expect(v.collisions).toHaveLength(1);
    });

    it('decides when values are bare (simple content without attributes) or objects', () => {
        const s = compile(`
            <xs:complexType name="bare"><xs:simpleContent><xs:extension base="xs:int"/></xs:simpleContent></xs:complexType>
            <xs:complexType name="attrs"><xs:simpleContent><xs:extension base="xs:int"><xs:attribute name="u" type="xs:string"/></xs:extension></xs:simpleContent></xs:complexType>
            <xs:complexType name="textOnly" mixed="true"/>`);
        expect(getContentView(complex(s, 'bare')).objectForm).toBe(false);
        expect(getContentView(complex(s, 'attrs')).objectForm).toBe(true);
        expect(getContentView(complex(s, 'textOnly')).objectForm).toBe(false);
    });
});

describe('chameleon-free namespace handling', () => {
    it('keys components by namespace', () => {
        const s = compileXsd(
            `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:t="urn:t" targetNamespace="urn:t">
               <xs:element name="a" type="t:b"/><xs:complexType name="b"/></xs:schema>`,
        );
        expect([...s.elements.keys()]).toEqual(['{urn:t}a']);
        expect([...s.types.keys()]).toEqual(['{urn:t}b']);
        expect(s.targetNamespaces).toEqual(['urn:t']);
    });
});
