import stubDefaultPrimitivesParsedXml from './stubs/default-primitives-parsed-xml.json';
import stubSchemaCompliantPrimitivesParsedXml from './stubs/schema-compliant-primitives-parsed-xml.json';
import { createParser, parse } from '../src/parser/parser';
import { join } from 'path';
import assert from 'assert';
import { readFileSync } from 'fs';
import extractFields from '../src/codegen/extract-fields';
import { Openimmo, Schema } from './stubs/interfaces';
import { createBuilder } from '../src/builder/builder';
import { stubXmlObject } from './stubs/data';

const xsdFilePath = join(__dirname, 'assets', 'openimmo_127b.xsd');
const xmlFilePath = join(__dirname, 'assets', 'openimmo-data_127.xml');
const xml = readFileSync(xmlFilePath).toString();

describe('parser', () => {
    it('yeld same json given the same xml (defaultPrimitivesParser)', () => {
        const _parse = createParser<Openimmo>();
        const object = _parse(xml);

        assert.equal(
            JSON.stringify(object),
            JSON.stringify(stubDefaultPrimitivesParsedXml),
        );
    });
    it('yeld same json given the same xml (schemaCompliantPrimitivesParser)', () => {
        const _parse = createParser<Openimmo>(xsdFilePath);
        const object = _parse(xml);

        assert.equal(
            JSON.stringify(object),
            JSON.stringify(stubSchemaCompliantPrimitivesParsedXml),
        );
    });
    it('parse back built xml to original object', () => {
        const build = createBuilder(xsdFilePath);
        const xml = build(stubXmlObject, 'openimmo');

        const _parse = createParser<Openimmo>(xsdFilePath);
        const object = _parse(xml);

        assert.deepEqual(object, stubXmlObject.openimmo);
    });
});
