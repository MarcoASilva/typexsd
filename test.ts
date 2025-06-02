import { readFileSync } from 'fs';
import { createParser } from './src'; // See #2
import type { CrosswayBible } from './interfaces';

const parse = createParser<CrosswayBible>(
    // This .xsd file is the one I combined manually. See #1
    './issue_schemas/crossway.bibles-test.xsd',
);

// Unfortunately, I'm not allowed to share this XML file publicly. But I could send it to you personally for development purposes.
const xml = readFileSync('example.xml').toString();

const bible: CrosswayBible = parse(xml); // I get an error on this line, shown below.

console.log(bible);
