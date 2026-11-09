import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
    createBuilder,
    createParser,
    generateTypes,
    loadSchemaSync,
} from '../src';
import { formatDiagnostic } from '../src/xsd/diagnostics';
import { stubXmlObject } from './stubs/data';
import { typecheck } from './helpers';

const assets = join(__dirname, 'assets');
const read = (...parts: string[]) =>
    readFileSync(join(assets, ...parts), 'utf8');

describe('OpenImmo 1.2.7', () => {
    const xsd = join(assets, 'openimmo_127b.xsd');
    const schema = loadSchemaSync(xsd);

    it('loads without errors (one known schema quirk is reported as a warning)', () => {
        expect(schema.diagnostics.filter(d => d.severity === 'error')).toEqual(
            [],
        );
        expect(schema.diagnostics.map(formatDiagnostic).join('\n')).toMatch(
            /complextype-simplecontent-mixed/,
        );
        expect(schema.elements.size).toBe(341);
    });

    it('generates the same, compilable, interfaces', async () => {
        const source = generateTypes(schema);
        await expect(source).toMatchFileSnapshot(
            './stubs/openimmo.interfaces.ts',
        );
        expect(typecheck(source)).toEqual([]);
    });

    it('builds the stub document byte for byte', () => {
        const build = createBuilder(schema);
        expect(build(stubXmlObject, 'openimmo')).toBe(read('stub.xml'));
    });

    it('parses the stub document back to the data it was built from', () => {
        const parse = createParser(schema);
        expect(parse(read('stub.xml'))).toEqual(stubXmlObject.openimmo);
    });

    it('parses the full example document (types, arrays, attributes, any)', async () => {
        const parse = createParser(schema);
        const data = parse(read('openimmo-data_127.xml'));
        await expect(JSON.stringify(data, null, 2) + '\n').toMatchFileSnapshot(
            './stubs/openimmo-data.parsed.json',
        );
        // schema typing: arrays where the schema allows several, numbers and booleans by type
        expect(Array.isArray(data.anbieter)).toBe(true);
        expect(data.anbieter[0].immobilie[0].geo.etage).toBe(1);
        expect(data.anbieter[0].immobilie[0].geo.karten_makro).toBe(true);
        expect(data.anbieter[0].immobilie[0].geo.plz).toBe('');
    });

    it('rebuilds the full example into XML that parses to the same data', () => {
        const parse = createParser(schema);
        const build = createBuilder(schema);
        const data = parse(read('openimmo-data_127.xml'));
        // xs:any content is loosely typed (attributes and elements are indistinguishable
        // in the flat convention), so it cannot be expected to survive a round trip
        const stripAny = (value: any): any => {
            if (Array.isArray(value)) return value.map(stripAny);
            if (value && typeof value === 'object')
                return Object.fromEntries(
                    Object.entries(value)
                        .filter(([k]) => k !== 'user_defined_anyfield')
                        .map(([k, v]) => [k, stripAny(v)]),
                );
            return value;
        };
        const typed = stripAny(data);
        const rebuilt = build({ openimmo: typed }, 'openimmo');
        expect(parse(rebuilt)).toEqual(typed);
    });
});
