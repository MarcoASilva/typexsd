import { join } from 'path';
import extractFields from './extract-fields';
import buildInterfaces from './build-interfaces';

export * from './builder';
// export * from './interfaces';
// export * from './utils/xml-validator';

if (process.argv.some(arg => arg === '--generate')) {
    const xsdFilePath = process.argv[process.argv.indexOf('--generate') + 1];
    // const outputFields = process.argv.some(arg => arg === '--output-fields');
    buildInterfaces(extractFields(xsdFilePath));
}
