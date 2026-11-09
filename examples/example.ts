import { deepStrictEqual } from 'assert';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createBuilder, createParser, loadSchemaSync } from '../src';
import type { Openimmo, Schema } from './new-interfaces';

const schema: Schema = {
    openimmo: {
        uebertragung: {
            art: 'ONLINE',
            sendersoftware: 'my-software',
            senderversion: 'v1',
            umfang: 'TEIL',
            version: '1.0',
        },
        anbieter: [
            {
                firma: 'Joe LLC',
                openimmo_anid: 'UH321890UA9',
            },
        ],
    },
};

// compile the XSD once; the builder and the parser share it
const compiled = loadSchemaSync(join(__dirname, 'openimmo_127b.xsd'));

const build = createBuilder(compiled);
const parse = createParser<Openimmo>(compiled);

const xml = build(schema, 'openimmo');

const openimmo = parse(xml);

deepStrictEqual(schema.openimmo, openimmo);

writeFileSync(join(__dirname, 'output.xml'), xml);
