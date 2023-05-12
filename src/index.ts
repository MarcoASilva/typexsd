import extractFields from './codegen/extract-fields';
import buildInterfaces from './codegen/build-interfaces';
import { writeFileSync } from 'fs';

export * from './builder/builder';
// export * from './interfaces';
// export * from './utils/xml-validator';

if (process.argv.some(arg => arg === '--generate')) {
    const xsdFilePath = process.argv[process.argv.indexOf('--generate') + 1];
    // const outputFields = process.argv.some(arg => arg === '--output-fields');
    writeFileSync('interfaces.ts', buildInterfaces(extractFields(xsdFilePath)));
}
