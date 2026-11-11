import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { compile } from './helpers';
import { generateTypes, generateZod } from '../src/codegen';

const el = (n: string, type = 'xs:string', attrs = '') =>
    `<xs:element name="${n}" type="${type}" ${attrs}/>`;

const zod = (body: string, options: { encodeFacets?: boolean } = {}): string =>
    generateZod(compile(body), {
        header: false,
        docs: false,
        ...options,
    });

describe('zod codegen', () => {
    it('emits structural twins of the TypeScript types', () => {
        const body = `<xs:element name="root"><xs:complexType><xs:sequence>
            ${el('required')}
            ${el('optional', 'xs:int', 'minOccurs="0"')}
            ${el('list', 'xs:boolean', 'maxOccurs="unbounded"')}
        </xs:sequence></xs:complexType></xs:element>`;
        const types = generateTypes(compile(body), {
            header: false,
            docs: false,
        });
        const schemas = zod(body);

        expect(types).toContain('required: string;');
        expect(types).toContain('optional?: number;');
        expect(types).toContain('list: boolean[];');

        expect(schemas).toContain("import { z } from 'zod';");
        expect(schemas).toMatch(
            /export const RootSchema = z\.lazy\(\(\) => z\.object\(\{\s*required: z\.string\(\),\s*optional: z\.number\(\)\.optional\(\),\s*list: z\.array\(z\.boolean\(\)\)/,
        );
        expect(schemas).toContain('export const SchemaSchema = z.lazy(() =>');
        // structural twin: no facet methods by default
        expect(schemas).not.toMatch(/\.min\(/);
        expect(schemas).not.toMatch(/\.max\(/);
        expect(schemas).not.toMatch(/\.regex\(/);
    });

    it('represents optional choices with an empty object alternative', () => {
        expect(
            zod(
                `<xs:complexType name="t"><xs:choice minOccurs="0">${el(
                    'a',
                )}${el('b')}</xs:choice></xs:complexType>`,
            ),
        ).toContain('z.object({})');
    });

    it('combines several choices with .and instead of exploding branches', () => {
        const choice = (p: string) =>
            `<xs:choice>${[1, 2]
                .map(i => el(`${p}${i}`))
                .join('')}</xs:choice>`;
        const out = zod(
            `<xs:complexType name="t"><xs:sequence>${choice('a')}${choice(
                'b',
            )}</xs:sequence></xs:complexType>`,
        );
        expect(out).toContain('.and(');
        expect(out.match(/z\.union\(/g)?.length).toBe(2);
    });

    it('encodes XSD facets when encodeFacets is set', () => {
        const out = zod(
            `<xs:simpleType name="code">
                <xs:restriction base="xs:string">
                    <xs:minLength value="2"/>
                    <xs:maxLength value="4"/>
                    <xs:pattern value="[A-Z]+"/>
                </xs:restriction>
             </xs:simpleType>
             <xs:simpleType name="age">
                <xs:restriction base="xs:integer">
                    <xs:minInclusive value="0"/>
                    <xs:maxInclusive value="120"/>
                </xs:restriction>
             </xs:simpleType>
             <xs:element name="root"><xs:complexType><xs:sequence>
                <xs:element name="code" type="code"/>
                <xs:element name="age" type="age"/>
                <xs:element name="tags" type="xs:string" minOccurs="2" maxOccurs="5"/>
             </xs:sequence></xs:complexType></xs:element>`,
            { encodeFacets: true },
        );

        expect(out).toContain(
            'CodeSchema = z.lazy(() => z.string().min(2).max(4).regex(',
        );
        expect(out).toContain(
            'AgeSchema = z.lazy(() => z.number().min(0).max(120)',
        );
        expect(out).toContain('tags: z.array(z.string()).min(2).max(5)');
    });

    it('keeps facet-less structural form when encodeFacets is off', () => {
        const out = zod(
            `<xs:simpleType name="code">
                <xs:restriction base="xs:string">
                    <xs:minLength value="2"/>
                    <xs:pattern value="[A-Z]+"/>
                </xs:restriction>
             </xs:simpleType>
             <xs:element name="x" type="code"/>`,
        );
        expect(out).toMatch(/CodeSchema = z\.lazy\(\(\) => z\.string\(\)\);/);
        expect(out).not.toContain('.min(');
        expect(out).not.toContain('.regex(');
    });

    it('produces schemas that parse matching values', () => {
        const source = zod(
            `<xs:element name="root"><xs:complexType><xs:sequence>
                ${el('name')}
                ${el('count', 'xs:int', 'minOccurs="0"')}
            </xs:sequence></xs:complexType></xs:element>`,
        );
        // Evaluate the generated module against real zod (CJS-style).
        const body = source
            .replace(/import \{ z \} from 'zod';\s*/, '')
            .replace(/export const /g, 'exports.');
        const mod = { exports: {} as Record<string, z.ZodTypeAny> };
        const fn = new Function('exports', 'z', body);
        fn(mod.exports, z);
        const RootSchema = mod.exports.RootSchema;
        expect(RootSchema.parse({ name: 'a', count: 1 })).toEqual({
            name: 'a',
            count: 1,
        });
        expect(RootSchema.parse({ name: 'a' })).toEqual({ name: 'a' });
        expect(() => RootSchema.parse({})).toThrow();
    });

    it('handles extension via .and', () => {
        const out = zod(`
            <xs:complexType name="base"><xs:sequence>${el(
                'a',
            )}</xs:sequence></xs:complexType>
            <xs:complexType name="derived">
                <xs:complexContent>
                    <xs:extension base="base"><xs:sequence>${el(
                        'b',
                    )}</xs:sequence></xs:extension>
                </xs:complexContent>
            </xs:complexType>`);
        expect(out).toMatch(
            /DerivedSchema = z\.lazy\(\(\) => BaseSchema\.and\(z\.object\(\{\s*b: z\.string\(\),/,
        );
    });
});
