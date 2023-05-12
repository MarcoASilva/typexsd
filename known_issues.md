## builder

### 001 choices with minOccurs="0"

That means that it should create one more variation without any of the choice
props (as it's optional by minOccurs 0)

### 002 complexType element with both attrs/subElements and a value

In this case the generated type will add a new property with the same name as
the element name to hold its value

E.g:

```typescript
// element "Data" (type string, attrs: ["category" (type string)])
interface Data {
    category: string;
    data: string;
}
```

### 003 object with props and primitive value (derived from #002)

If object has both "\_text" and "\_attibutes" or inner elements, a prop with the
object's name is created to hold the "\_text" value

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
