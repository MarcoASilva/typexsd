# typexml

Type-safe xml builder base in xsd for Typescript environments

### Install

`npm i typexml`
or
`yard add typexml`

### codegen

In your project, after installing `typexml`, run the following to generate types for your XSD:

`npx typexml generate ${path-to-xsd-file.xsd}`

This should generate `interfaces.ts`.

`interfaces.ts` holds the collection of types extracted from the provided xsd schema. It can be imported anywhere you want to generate a compliant XML.

### usage

```typescript
import { createBuilder } from "typemxml";
import { Schema } from "/path/to/interfaces.ts";

const openImmo: Schema = {
    openimmo: {
        anbieter: {
            firma: "Joe LLC",
            openimmo_anid: "09sa0d9ad90",
        },
        uebertragung: {
            art: "ONLINE",
            sendersoftware: "some-software",
            senderversion: "v1.0.1",
            umfang: "VOLL",
            version: "v1",
        },
    },
};

const build = createBuilder({ xsdFilePath: "openimmo_127b.xsd" });

const xml = build(schema, "openimmo");

writeFileSync("openimmo.xml", xml);
```

### validation

Optionally you can validate the xml output

```typescript
import { validate, OpenImmoValidationError } from "typexml";

try {
    validate(xml);
} catch (e) {
    if (e instanceof OpenImmoValidationError) {
        console.warn(e.errors.map((e) => e.message));
        console.warn(e.errors.length, "validation errors");
        // and fail safe optionally
        return e.xml;
    }
    throw e;
}
```
