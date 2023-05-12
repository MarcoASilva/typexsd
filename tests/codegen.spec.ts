import stubInterfacesDescription from './stubs/interfaces.json';
import extractFields from '../src/codegen/extract-fields';
import buildInterfaces from '../src/codegen/build-interfaces';
import { join } from 'path';
import assert from 'assert';
import { readFileSync } from 'fs';

const xsdFilePath = join(__dirname, 'assets', 'openimmo_127b.xsd');
const stubInterfaces = readFileSync(join(__dirname, 'stubs', 'interfaces.ts'));

describe('Generate command', () => {
    it('yeld same interfaces description json given the same xsd', () => {
        const interfaces = extractFields(xsdFilePath);

        assert.equal(
            JSON.stringify(interfaces),
            JSON.stringify(stubInterfacesDescription),
        );
    });
    it('yeld same interfaces given the same xsd ', () => {
        const interfaces = buildInterfaces(extractFields(xsdFilePath));
        assert.equal(interfaces, stubInterfaces);
    });
});
