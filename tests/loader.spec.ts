import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { loadSchema, loadSchemaSync } from '../src';
import { loadSchemaSetSync } from '../src/xsd/loader';
import { ComplexTypeDef } from '../src/xsd/model';
import { XS, errorCodes, schemaXml } from './helpers';
import { getContentView } from '../src/xsd/view';

const doc = (body: string, attrs = '') => schemaXml(body, attrs);

const load = (sources: Record<string, string>, entry = 'main.xsd') =>
    loadSchemaSync(entry, { sources });

describe('include', () => {
    it('merges components of included schemas', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:include schemaLocation="types.xsd"/><xs:element name="a" type="t"/>`,
            ),
            'types.xsd': doc(
                `<xs:complexType name="t"><xs:sequence><xs:element name="x" type="xs:string"/></xs:sequence></xs:complexType>`,
            ),
        });
        expect(errorCodes(s)).toEqual([]);
        expect(s.documents).toEqual(['main.xsd', 'types.xsd']);
        expect(s.elements.get('a')!.type).toBe(s.types.get('t'));
    });

    it('resolves relative locations against the including document', () => {
        const s = load({
            'main.xsd': doc(`<xs:include schemaLocation="sub/a.xsd"/>`),
            'sub/a.xsd': doc(`<xs:include schemaLocation="b.xsd"/>`),
            'sub/b.xsd': doc(`<xs:element name="b" type="xs:string"/>`),
        });
        expect(errorCodes(s)).toEqual([]);
        expect(s.elements.has('b')).toBe(true);
    });

    it('survives include cycles', () => {
        const s = load(
            {
                'a.xsd': doc(
                    `<xs:include schemaLocation="b.xsd"/><xs:element name="a" type="xs:string"/>`,
                ),
                'b.xsd': doc(
                    `<xs:include schemaLocation="a.xsd"/><xs:element name="b" type="xs:string"/>`,
                ),
            },
            'a.xsd',
        );
        expect(errorCodes(s)).toEqual([]);
        expect([...s.elements.keys()]).toEqual(['a', 'b']);
    });

    it('loads a document included twice only once', () => {
        const set = loadSchemaSetSync('main.xsd', {
            sources: {
                'main.xsd': doc(
                    `<xs:include schemaLocation="a.xsd"/><xs:include schemaLocation="b.xsd"/>`,
                ),
                'a.xsd': doc(`<xs:include schemaLocation="c.xsd"/>`),
                'b.xsd': doc(`<xs:include schemaLocation="c.xsd"/>`),
                'c.xsd': doc(`<xs:element name="c" type="xs:string"/>`),
            },
        });
        expect(set.documents.map(d => d.location)).toEqual([
            'main.xsd',
            'a.xsd',
            'b.xsd',
            'c.xsd',
        ]);
        expect(set.diagnostics.errors).toEqual([]);
    });

    it('reports includes that cannot be loaded, and keeps going', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:include schemaLocation="nope.xsd"/><xs:element name="a" type="xs:string"/>`,
            ),
        });
        expect(errorCodes(s)).toEqual(['schema-load-failed']);
        expect(s.elements.has('a')).toBe(true);
    });

    it('reports included documents that are malformed or not schemas', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:include schemaLocation="bad.xsd"/><xs:include schemaLocation="other.xsd"/>`,
            ),
            'bad.xsd': '<xs:schema xmlns:xs="' + XS + '"><xs:element',
            'other.xsd': '<html/>',
        });
        expect(errorCodes(s).sort()).toEqual([
            'not-a-schema',
            'schema-malformed',
        ]);
    });

    it('rejects an include whose namespace differs', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:include schemaLocation="o.xsd"/>`,
                'targetNamespace="urn:a"',
            ),
            'o.xsd': doc(
                `<xs:element name="o" type="xs:string"/>`,
                'targetNamespace="urn:b"',
            ),
        });
        expect(errorCodes(s)).toContain('include-namespace-mismatch');
    });
});

describe('chameleon include', () => {
    const sources = {
        'main.xsd': doc(
            `<xs:include schemaLocation="cham.xsd"/>
             <xs:element name="root" type="t:box"/>`,
            'targetNamespace="urn:main" xmlns:t="urn:main"',
        ),
        'cham.xsd':
            doc(`<xs:complexType name="box"><xs:sequence><xs:element name="item" type="item"/></xs:sequence></xs:complexType>
                         <xs:simpleType name="item"><xs:restriction base="xs:string"/></xs:simpleType>`),
    };

    it('adopts the namespace of the including schema', () => {
        const s = load(sources);
        expect(errorCodes(s)).toEqual([]);
        expect([...s.types.keys()].sort()).toEqual([
            '{urn:main}box',
            '{urn:main}item',
        ]);
        const box = s.types.get('{urn:main}box') as ComplexTypeDef;
        expect(getContentView(box).shape.slots[0].decl.type).toBe(
            s.types.get('{urn:main}item'),
        );
    });

    it('can be included into two namespaces', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:import namespace="urn:b" schemaLocation="b.xsd"/><xs:include schemaLocation="cham.xsd"/>`,
                'targetNamespace="urn:a"',
            ),
            'b.xsd': doc(
                `<xs:include schemaLocation="cham.xsd"/>`,
                'targetNamespace="urn:b"',
            ),
            'cham.xsd': doc(`<xs:element name="e" type="xs:string"/>`),
        });
        expect(errorCodes(s)).toEqual([]);
        expect([...s.elements.keys()].sort()).toEqual(['{urn:a}e', '{urn:b}e']);
    });
});

describe('import', () => {
    it('makes components of another namespace available', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:import namespace="urn:b" schemaLocation="b.xsd"/><xs:element name="a" type="b:t"/>`,
                'targetNamespace="urn:a" xmlns:b="urn:b"',
            ),
            'b.xsd': doc(
                `<xs:complexType name="t"/>`,
                'targetNamespace="urn:b"',
            ),
        });
        expect(errorCodes(s)).toEqual([]);
        expect(s.targetNamespaces.sort()).toEqual(['urn:a', 'urn:b']);
        expect(s.elements.get('{urn:a}a')!.type).toBe(s.types.get('{urn:b}t'));
    });

    it('accepts imports without schemaLocation (the namespace is only declared)', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:import namespace="urn:x"/><xs:element name="a" type="xs:string"/>`,
            ),
        });
        expect(errorCodes(s)).toEqual([]);
    });

    it('detects a namespace that does not match the import declaration', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:import namespace="urn:b" schemaLocation="b.xsd"/>`,
                'targetNamespace="urn:a"',
            ),
            'b.xsd': doc(
                `<xs:complexType name="t"/>`,
                'targetNamespace="urn:other"',
            ),
        });
        expect(errorCodes(s)).toContain('import-namespace-mismatch');
    });

    it('never tries to load the XML namespace schema (xml:lang and friends are built in)', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:import namespace="http://www.w3.org/XML/1998/namespace" schemaLocation="http://www.w3.org/2001/xml.xsd"/>
                 <xs:complexType name="t"><xs:attribute ref="xml:lang"/></xs:complexType>`,
                'xmlns:xml="http://www.w3.org/XML/1998/namespace"',
            ),
        });
        expect(errorCodes(s)).toEqual([]);
        expect(s.documents).toEqual(['main.xsd']);
    });

    it('provides the xml: attributes (xml:lang, xml:space, xml:base, xml:id)', () => {
        const s = loadSchemaSync({
            location: 'm.xsd',
            text: doc(
                `<xs:complexType name="t"><xs:attribute ref="xml:lang"/><xs:attribute ref="xml:space"/></xs:complexType>`,
                'xmlns:xml="http://www.w3.org/XML/1998/namespace"',
            ),
        });
        expect(errorCodes(s)).toEqual([]);
        expect(
            (s.types.get('t') as ComplexTypeDef).attributes.map(
                a => a.decl.name.local,
            ),
        ).toEqual(['lang', 'space']);
    });
});

describe('redefine and override', () => {
    const original = doc(`
        <xs:simpleType name="code"><xs:restriction base="xs:string"><xs:maxLength value="10"/></xs:restriction></xs:simpleType>
        <xs:complexType name="person"><xs:sequence><xs:element name="name" type="xs:string"/></xs:sequence></xs:complexType>
        <xs:group name="g"><xs:sequence><xs:element name="a" type="xs:string"/></xs:sequence></xs:group>
        <xs:attributeGroup name="ag"><xs:attribute name="x" type="xs:string"/></xs:attributeGroup>
        <xs:element name="use" type="person"/>`);

    it('redefine: self references in the new definition mean the original', () => {
        const s = load({
            'main.xsd': doc(`<xs:redefine schemaLocation="orig.xsd">
                <xs:simpleType name="code"><xs:restriction base="code"><xs:maxLength value="3"/></xs:restriction></xs:simpleType>
                <xs:complexType name="person"><xs:complexContent><xs:extension base="person">
                    <xs:sequence><xs:element name="age" type="xs:int"/></xs:sequence></xs:extension></xs:complexContent></xs:complexType>
                <xs:group name="g"><xs:sequence><xs:group ref="g"/><xs:element name="b" type="xs:string"/></xs:sequence></xs:group>
                <xs:attributeGroup name="ag"><xs:attributeGroup ref="ag"/><xs:attribute name="y" type="xs:string"/></xs:attributeGroup>
              </xs:redefine>`),
            'orig.xsd': original,
        });
        expect(errorCodes(s)).toEqual([]);

        // components referring to the name see the redefined version
        const person = s.elements.get('use')!.type as ComplexTypeDef;
        expect(getContentView(person).shape.slots.map(x => x.key)).toEqual([
            'name',
            'age',
        ]);
        expect(
            person.base.kind === 'complex' &&
                person.base.name!.local.startsWith('person#original'),
        ).toBe(true);

        const code = s.types.get('code') as any;
        expect(code.facets.maxLength).toBe(3);
        expect(code.base.facets.maxLength).toBe(10);

        const g = s.groups.get('g')!.group;
        expect(g.particles).toHaveLength(2);
        expect((g.particles[0].term as any).origin.local).toMatch(
            /^g#original/,
        );
        expect(
            s.attributeGroups
                .get('ag')!
                .attributes.map(a => a.decl.name.local)
                .sort(),
        ).toEqual(['x', 'y']);
    });

    it('redefine of a missing component is an error', () => {
        const s = load({
            'main.xsd': doc(
                `<xs:redefine schemaLocation="orig.xsd"><xs:simpleType name="nope"><xs:restriction base="xs:string"/></xs:simpleType></xs:redefine>`,
            ),
            'orig.xsd': original,
        });
        expect(errorCodes(s)).toEqual(['redefine-target-missing']);
    });

    it('override: replaces the component outright (XSD 1.1)', () => {
        const s = load({
            'main.xsd': doc(`<xs:override schemaLocation="orig.xsd">
                <xs:complexType name="person"><xs:sequence><xs:element name="nick" type="xs:string"/></xs:sequence></xs:complexType>
              </xs:override>`),
            'orig.xsd': original,
        });
        expect(errorCodes(s)).toEqual([]);
        const person = s.elements.get('use')!.type as ComplexTypeDef;
        expect(getContentView(person).shape.slots.map(x => x.key)).toEqual([
            'nick',
        ]);
    });
});

describe('locations', () => {
    it('loads from the filesystem relative to the entry file', () => {
        const dir = mkdtempSync(join(tmpdir(), 'typexsd-'));
        writeFileSync(
            join(dir, 'main.xsd'),
            doc(`<xs:include schemaLocation="inc.xsd"/>`),
        );
        writeFileSync(
            join(dir, 'inc.xsd'),
            doc(`<xs:element name="a" type="xs:string"/>`),
        );
        const s = loadSchemaSync(join(dir, 'main.xsd'));
        expect(s.elements.has('a')).toBe(true);
    });

    it('honors the encoding declared in the XML declaration', () => {
        const dir = mkdtempSync(join(tmpdir(), 'typexsd-'));
        const xml = `<?xml version="1.0" encoding="iso-8859-1"?>${doc(
            `<xs:element name="a" type="xs:string"><xs:annotation><xs:documentation>Stra\u00dfe</xs:documentation></xs:annotation></xs:element>`,
        )}`;
        writeFileSync(join(dir, 'latin.xsd'), Buffer.from(xml, 'latin1'));
        const s = loadSchemaSync(join(dir, 'latin.xsd'));
        expect(s.elements.get('a')!.annotation!.documentation[0].text).toBe(
            'Stra\u00dfe',
        );
    });

    it('maps remote locations to local files with urlMap (table or function)', () => {
        const sources = {
            'main.xsd': doc(
                `<xs:include schemaLocation="http://example.com/schemas/base.xsd"/>`,
            ),
            'local-base.xsd': doc(`<xs:element name="base" type="xs:string"/>`),
        };
        for (const urlMap of [
            { 'http://example.com/schemas/base.xsd': 'local-base.xsd' },
            (url: string) =>
                url.endsWith('base.xsd') ? 'local-base.xsd' : undefined,
        ]) {
            const s = loadSchemaSync('main.xsd', { sources, urlMap });
            expect(errorCodes(s)).toEqual([]);
            expect(s.elements.has('base')).toBe(true);
        }
    });

    it('can fall back to a same-named file next to the including schema', () => {
        const dir = mkdtempSync(join(tmpdir(), 'typexsd-'));
        writeFileSync(
            join(dir, 'main.xsd'),
            doc(`<xs:include schemaLocation="http://example.com/x/base.xsd"/>`),
        );
        writeFileSync(
            join(dir, 'base.xsd'),
            doc(`<xs:element name="base" type="xs:string"/>`),
        );
        expect(
            loadSchemaSync(join(dir, 'main.xsd'), {
                localFallback: true,
            }).elements.has('base'),
        ).toBe(true);
        expect(errorCodes(loadSchemaSync(join(dir, 'main.xsd')))).toEqual([
            'schema-load-failed',
        ]);
    });

    it('fetches remote schemas in the async loader', async () => {
        const fetched: string[] = [];
        const fakeFetch = (async (url: string) => {
            fetched.push(url);
            const body = url.endsWith('base.xsd')
                ? doc(
                      `<xs:include schemaLocation="more.xsd"/><xs:element name="base" type="xs:string"/>`,
                  )
                : doc(`<xs:element name="more" type="xs:string"/>`);
            return {
                ok: true,
                status: 200,
                arrayBuffer: async () => new TextEncoder().encode(body).buffer,
            };
        }) as unknown as typeof fetch;
        const s = await loadSchema(
            {
                location: 'main.xsd',
                text: doc(
                    `<xs:include schemaLocation="http://example.com/s/base.xsd"/>`,
                ),
            },
            { fetch: fakeFetch },
        );
        expect(fetched).toEqual([
            'http://example.com/s/base.xsd',
            'http://example.com/s/more.xsd',
        ]);
        expect([...s.elements.keys()]).toEqual(['base', 'more']);
    });

    it('reports failed downloads', async () => {
        const failing = (async () => ({
            ok: false,
            status: 404,
        })) as unknown as typeof fetch;
        const s = await loadSchema(
            {
                location: 'main.xsd',
                text: doc(
                    `<xs:include schemaLocation="http://example.com/x.xsd"/>`,
                ),
            },
            { fetch: failing },
        );
        expect(errorCodes(s)).toEqual(['schema-load-failed']);
        expect(s.diagnostics[0].message).toMatch(/404/);
    });

    it('explains how to load remote schemas synchronously', () => {
        const s = loadSchemaSync({
            location: 'main.xsd',
            text: doc(
                `<xs:include schemaLocation="http://example.com/x.xsd"/>`,
            ),
        });
        expect(s.diagnostics[0].message).toMatch(/async|urlMap/);
    });
});
