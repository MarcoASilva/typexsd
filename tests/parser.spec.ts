import stubParsedXml from './stubs/parsed.json';
import { parse } from '../src/parser/parser';
import { join } from 'path';
import assert from 'assert';
import { readFileSync } from 'fs';

const xmlFilePath = join(__dirname, 'assets', 'openimmo-data_127.xml');
const xml = readFileSync(xmlFilePath).toString();

describe('Generate command', () => {
    it('yeld same json given the same xml', () => {
        const object = parse(xml);
        assert.equal(JSON.stringify(object), JSON.stringify(stubParsedXml));
    });
});
