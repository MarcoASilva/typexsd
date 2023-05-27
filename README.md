# typexml

Type-safe xml parser and builder based in xsd for Typescript environments

### Install

`npm i typexml` or `yard add typexml`

### codegen

In your project, after installing `typexml`, run the following to generate types
for your XSD:

`npx typexml generate ${path-to-xsd-file.xsd}`

This should generate `interfaces.ts`.

`interfaces.ts` holds the collection of types extracted from the provided xsd
schema. It can be imported anywhere you want to generate a compliant XML.

### usage

Let's say you want to generated the element "**foo**" defined in your XSD file

```typescript
import { createBuilder } from 'typemxml';
import { Schema } from '/path/to/interfaces.ts';

const schema: Schema = {
    foo: {
        bar: 'bar'
        // fill in foo props with type safety...
        ...props,
    },
};

const build = createBuilder('path-to-xsd-file.xsd');

const xml: string = build(schema, 'foo');

writeFileSync('foo.xml', xml);
```

#### validation

You can validate the XML with the help of
[`xsd-validator`](https://www.npmjs.com/package/xsd-validator) package
(`npm i xsd-validator`) (or any other library of your choice...)

```typescript
import { readFileSync } from 'fs';
import { validate } from 'typexml';
import validateSchema, { ValidationError } from 'xsd-schema-validator';

const xsd = readFileSync('path-to-xsd-file.xsd').toString();

const errors: true | ValidationError[] = validateSchema(xml, xsd);

if (errors instanceof Array) {
    errors.forEach(e => console.error(e));
    throw new Error('Invalid XML');
}
```

It also comes with a parser in case you need

-   With XSD/interface compliant parsing:

```typescript
import { readFileSync } from 'fs';
import { createBuilder } from 'typemxml';
import { Foo } from '/path/to/interfaces.ts';

const xml = readFileSync('path-to-xml-file.xml').toString();

const parse = createParser<Foo>('path-to-xsd-file.xsd');

// whatever element was parsed is guaranteed to comply with both XSD/interface
const foo: Foo = parse(xml);

console.log(foo.bar.length);
```

-   Without:

```typescript
import { readFileSync } from 'fs';
import { createBuilder } from 'typemxml';
import { Foo } from '/path/to/interfaces.ts';

const xml = readFileSync('path-to-xml-file.xml').toString();

const parse = createParser();

// parse as any other regular xml parser returning a loosely typed Record<string, any>
const foo: Record<string, any> = parse(xml);

console.log(foo.bar?.length);
```
