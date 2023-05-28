import { writeFileSync } from 'fs';
import { createBuilder } from '../src';
import { Openimmo, Schema } from './interfaces';
import { createParser } from '../src/parser/parser';
import { deepEqual } from 'assert';

const schema: Schema = {
    openimmo: {
        uebertragung: {
            art: 'ONLINE',
            sendersoftware: 'my-software',
            senderversion: 'v1',
            umfang: 'TEIL',
            version: '1.0',
        },
        anbieter: {
            firma: 'Joe LLC',
            openimmo_anid: 'UH321890UA9',
        },
    },
};

const xsdFilePath = './openimmo_127b.xsd';

const build = createBuilder(xsdFilePath);
const parse = createParser<Openimmo>(xsdFilePath);

const xml = build(schema, 'openimmo');

const openimmo = parse(xml);

deepEqual(schema.openimmo, openimmo);

writeFileSync('output.xml', xml);
