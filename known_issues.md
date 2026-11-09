## data model

### 001 choices with minOccurs="0"

Solved. A `choice` with `minOccurs="0"` gets an extra empty alternative (`| {}`)
in the generated union, i.e. a variation without any of the choice's props.

### 002 complexType element with both attrs/subElements and a value

The generated type adds a new property with the same name as the element to
hold its value. When the type is used by one element name the property is part
of the interface; types shared by several element names get it attached where
they are used (`Tag & { first: string }`).

E.g:

```typescript
// element "Data" (type string, attrs: ["category" (type string)])
interface Data {
    category: string;
    data: string;
}
```

If an attribute or a child element already uses that name, the text property
becomes `<name>_text` and the interpreter reports the collision.

### 003 object with props and primitive value (derived from #002)

Parsing and building follow the same rule: if an object has both text and
attributes or inner elements, the text lives under the object's own name.

E.g:

```typescript
const data = {
    _attributes: {
        category: 'comment',
    },
    _text: 'A comment',
};

// becomes
const data = {
    category: 'comment',
    data: 'A comment',
};
```

### 004 mixed content loses the position of the text

Mixed content (`mixed="true"`) is represented as one text property next to the
child elements, so where the text sat between the children is not preserved:
`And <b>x</b> foo` is parsed to `{ b: ['x'], p: 'And  foo' }` and built back as
`And  foo<b>x</b>`.

### 005 the order of elements in repeating choices

A repeating `choice` becomes one optional array per element, so the relative
order of different elements (`<a/><b/><a/>`) is not preserved. The builder
writes them in schema order.

### 006 content matched by xs:any / anyType is loosely typed

Attributes and child elements of such content are siblings in the same object,
so the two cannot be told apart when building. The builder understands
`'@name'` for attributes and `'#text'` for text in that content; the parser
does not produce them.

## interpreter

### 007 not evaluated

-   Identity constraints (`unique`, `key`, `keyref`), assertions (`assert`,
    `assertion`) and type alternatives are parsed and kept as metadata.
-   Documents are not validated, and the schema itself is checked for the
    constraints that matter for interpretation, not for every constraint of the
    specification (e.g. unique particle attribution is not enforced).
-   `xsi:type` is honored by the parser for types that exist in the schema; the
    builder does not write it.
-   Extending `xs:anyType` ignores the wildcard content of `anyType` itself.
