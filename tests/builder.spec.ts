import { join } from 'path';
import assert from 'assert';
import { readFileSync } from 'fs';
import { createBuilder } from '../src/builder/builder';
import { schema } from './stubs/data';

const xsdFilePath = join(__dirname, 'assets', 'openimmo_127b.xsd');

const xmlFilePath = join(__dirname, 'assets', 'stub.xml');
const stubBuiltXml = readFileSync(xmlFilePath).toString();

describe('builder', () => {
    it('yeld same xml givem same data', () => {
        const build = createBuilder({
            xsdFilePath,
        });
        const xml = build(schema, 'openimmo');

        assert.equal(xml, stubBuiltXml);
    });
});
