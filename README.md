# typexsd

Type-safe XML builder and parser driven by an XSD, for TypeScript.

typexsd contains a real XML Schema interpreter: it loads your XSD (following
`include`, `import`, `redefine` and `override`), evaluates the rules of every
schema construct (cardinality, content models, derivation, facets, ...) and
uses the result to

-   generate accurate TypeScript types,
-   build XML from plain objects in the order the schema requires,
-   parse XML into plain objects with values converted by their XSD datatype.

## installation

`npm i typexsd`

Requires Node 18 or newer.

## codegen

`npx typexsd generate path/to/schema.xsd`

Writes `interfaces.ts` (change it with `--out`). The `Schema` interface lists
the global elements of the schema; every other type is named after the XSD type
or element it came from.

```
typexsd generate <schema.xsd> [options]

  --out <file>            Output file (default: interfaces.ts)
  --zod <file>            Also write Zod schemas to this file
  --zod-encode-xsd-facets Encode XSD facets as Zod checks (requires --zod)
  --map <url=path>        Load a remote schemaLocation from a local file (repeatable)
  --local-fallback        For unmapped remote includes, look for the same file name next to the including schema
  --type <xsd=ts>         Override the TypeScript type of a built-in datatype, e.g. --type dateTime=Date
  --root <name>           Name of the root interface (default: Schema)
  --doc-lang <lang>       Preferred documentation language (default: en)
  --no-docs               Do not emit XSD documentation as TSDoc
  --strict                Fail on any schema error
  --quiet                 Do not print diagnostics
```

The same thing from code:

```typescript
import { writeFileSync } from 'fs';
import { generateTypes, generateZod, loadSchema } from 'typexsd';

const schema = await loadSchema('path/to/schema.xsd'); // fetches http(s) includes
writeFileSync('interfaces.ts', generateTypes(schema, { docs: true }));
writeFileSync('schemas.ts', generateZod(schema)); // optional; peer-depends on zod
```

Pass `--zod schemas.ts` to emit a second file whose exports (`FooSchema`, …)
are structural twins of the generated interfaces. Add
`--zod-encode-xsd-facets` to also encode length/pattern/numeric bounds and
array `minOccurs`/`maxOccurs` as Zod checks (stricter than the TypeScript
types, which only document those facets in TSDoc).

### what the types look like

The XSD rules decide the shape of the types:

| XSD                                                   | TypeScript                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `minOccurs="0"`                                       | optional property                                                                            |
| `maxOccurs` greater than 1 (own, or inherited)        | array; `@minItems`/`@maxItems` in the TSDoc                                                  |
| `sequence` / `all`                                    | members of the same object                                                                   |
| `choice`                                              | union of the branches; `minOccurs="0"` adds an empty alternative                             |
| several or nested `choice`s                           | intersection of unions (no combinatorial explosion)                                          |
| repeating `choice`                                    | every member becomes an optional array                                                       |
| `group` / `attributeGroup` references                 | expanded where they are used                                                                 |
| `use="required"` / `optional` / `prohibited`          | required / optional / left out                                                               |
| `enumeration`                                         | union of literals (numbers and booleans stay numbers and booleans)                           |
| `pattern`, `min/maxLength`, `min/maxInclusive`, ...   | TSDoc tags (`@pattern`, `@maxLength`, `@minimum`, ...)                                       |
| named `simpleType`                                    | exported `type` alias                                                                        |
| `list` / `union`                                      | array / union                                                                                |
| `extension` of a complex type                         | `interface Derived extends Base` (an intersection when the base has choices)                 |
| `restriction` of a complex type                       | standalone type (the content may be narrowed)                                                |
| `nillable="true"`                                     | `T \| null`                                                                                  |
| `fixed`                                               | literal type                                                                                 |
| `default`                                             | `@default` in the TSDoc                                                                      |
| substitution groups                                   | the head's alternatives (`circle`, `square`, ...); abstract heads cannot be used             |
| `any` / `anyAttribute`                                | `[key: string]: unknown`                                                                     |
| `xs:anyType`                                          | `unknown`                                                                                    |
| `annotation` / `documentation`                        | TSDoc comments                                                                               |

Built-in datatypes map as follows: numeric types (`decimal`, `integer`, `int`,
`long`, `float`, `double`, ...) to `number`, `boolean` to `boolean`, binary
types to `Buffer`, every other one (strings, dates, durations, names, ...) to
`string`. Override any of them with `typeMap`.

### the data model

typexsd keeps one convention for objects:

-   attributes and child elements are properties of the same object,
-   an element's text lives under a property with the element's own name (when
    the element also has attributes or children, or mixed content),
-   elements that can repeat are always arrays.

```typescript
// <hauptmietzinsnetto hauptmietzinsust="123">777</hauptmietzinsnetto>
const price = { hauptmietzinsust: 123, hauptmietzinsnetto: 777 };
```

When an attribute and an element (or the text) would end up with the same
property name, the interpreter picks a unique one (`name_attribute`,
`name_text`) and reports it in `getContentView(type).collisions`.

## build

```typescript
import { createBuilder } from 'typexsd';
import type { Schema } from './interfaces';

const data: Schema = {
    foo: {
        // fill in foo's props with type safety...
        bar: 'bar',
    },
};

const build = createBuilder('path/to/schema.xsd');

const xml: string = build(data, 'foo');
```

The builder writes elements in the order of the schema (not the order of your
object), repeats elements for arrays, formats values through their datatype
(`Date` for `dateTime`/`date`, bytes for `hexBinary`/`base64Binary`, `INF` for
infinity, space separated lists, ...), writes `xsi:nil` for `null` on nillable
elements and declares namespaces from `targetNamespace` and the form defaults.

Options: `{ pretty: true, declaration: true }`. Mixed content is never
re-indented.

## parse

```typescript
import { readFileSync } from 'fs';
import { createParser } from 'typexsd';
import type { Foo } from './interfaces';

const xml = readFileSync('path/to/file.xml', 'utf8');

const parse = createParser<Foo>('path/to/schema.xsd');

const foo: Foo = parse(xml);
```

-   Values are converted by their XSD datatype, not by what they look like: an
    `xs:string` containing `007` stays `'007'`, an `xs:int` becomes a number, an
    `xs:boolean` accepts `true`, `false`, `1` and `0`.
-   `xs:list` values become arrays, `xs:union` picks the first member that fits.
-   `whiteSpace` facets apply (`token` collapses, `string` preserves).
-   `xsi:nil="true"` gives `null`; `xsi:type` is honored for known types.
-   The result is the value of the root element, not wrapped in its name.
-   The schema is compiled once, when the parser is created.

Options: `{ unknown: 'keep' | 'ignore' | 'error', dates: false }`. By default
attributes and elements that the schema does not describe are kept (loosely
typed); `dates: true` returns `Date` objects for `xs:dateTime` and `xs:date`
(combine it with `--type dateTime=Date --type date=Date` when generating).

Without a schema it does a loose parse: attributes and children become
properties, repeated elements become arrays, numbers and booleans are coerced.

```typescript
import { createParser } from 'typexsd';

const parse = createParser();
const foo: Record<string, any> = parse(xml);
```

## validation

typexsd does not validate documents against the schema. Use a validator such as
[`xsd-schema-validator`](https://www.npmjs.com/package/xsd-schema-validator) if
you need one.

## the schema interpreter

```typescript
import { loadSchemaSync, formatDiagnostic } from 'typexsd';

const schema = loadSchemaSync('path/to/schema.xsd');

for (const d of schema.diagnostics) console.warn(formatDiagnostic(d));
schema.elements; // global element declarations, fully resolved
schema.types; // named types: derivation, facets, content models
```

Every construct of XML Schema 1.0 is interpreted, and the XSD 1.1 ones that
affect types:

-   documents: `schema`, `include` (including chameleon includes), `import`,
    `redefine`, `override`, `annotation`, `documentation`, `appinfo`, `notation`
-   declarations: `element`, `attribute`, `attributeGroup`, `group`, `any`,
    `anyAttribute`, `alternative`
-   types: `simpleType` (`restriction`, `list`, `union`), `complexType`,
    `simpleContent`, `complexContent`, `extension`, `restriction`,
    `sequence`, `choice`, `all`, `openContent`, `defaultOpenContent`
-   facets: `length`, `minLength`, `maxLength`, `pattern`, `enumeration`,
    `whiteSpace`, `minInclusive`, `maxInclusive`, `minExclusive`,
    `maxExclusive`, `totalDigits`, `fractionDigits`, `explicitTimezone`,
    `assertion`
-   identity constraints: `unique`, `key`, `keyref`, `selector`, `field`
    (kept as metadata, not evaluated), and `assert`
-   all built-in datatypes

Each XML Schema element is described by a declarative rule (`src/xsd/rules`):
the attributes it accepts with their defaults, the children it accepts and in
which order, and the constraints between them (`name` xor `ref`, `default`
xor `fixed`, `minOccurs <= maxOccurs`, global-only and local-only attributes,
...). Violations are collected as diagnostics instead of aborting, because
real-world schemas are messy; pass `{ strict: true }` to throw an `XsdError`
instead.

### remote and relative includes

`include`, `import`, `redefine` and `override` locations are resolved relative
to the including schema. `http(s)` locations need the async `loadSchema`; for
offline use map them to local files:

```typescript
loadSchemaSync('main.xsd', {
    urlMap: { 'http://example.com/schemas/base.xsd': './schemas/base.xsd' },
    // or: localFallback: true  (same file name next to the including schema)
});
```

The XML namespace (`xml:lang`, `xml:space`, ...) is built in and never fetched.
Documents are decoded according to their XML declaration (`iso-8859-1`, ...).

## upgrading from 0.3

-   Generated types are accurate about cardinality: elements with
    `maxOccurs` greater than 1 are arrays, choices are unions, and the numbered
    `Foo1`/`Foo2` variants are gone.
-   `createParser` and `createBuilder` compile the schema once.
-   Parsing returns arrays for repeatable elements, even for one occurrence.
-   `build({ declarationsPath })` is gone; pass `{ xsdFilePath }`, or a
    compiled schema, instead.
-   The CLI is `typexsd generate <xsd>` as before, but importing the package no
    longer runs it.
