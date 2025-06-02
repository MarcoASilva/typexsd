#!/usr/bin/env node

import extractFields from './codegen/extract-fields';
import buildInterfaces from './codegen/build-interfaces';
import { writeFileSync } from 'fs';

export * from './builder/builder';
export * from './parser/parser';

if (process.argv.some(arg => arg === 'generate')) {
    const xsdFilePath = process.argv[process.argv.indexOf('generate') + 1];
    writeFileSync('interfaces.ts', buildInterfaces(extractFields(xsdFilePath)));
}
