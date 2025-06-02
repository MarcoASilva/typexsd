import { readFileSync, write, writeFileSync } from 'fs';
import { isNil, isUndefined, omitBy } from 'lodash';
import { AtLeast } from 'ts-toolbelt/out/Object/AtLeast';
import {
    xml2js,
    Element,
    Attributes,
    xml2json,
    js2xml,
    json2xml,
} from 'xml-js';

export interface Prop {
    name: string;
    required: boolean;
    array?: boolean;
    choice?: number;
    isAttr?: boolean;
    // at least one of the three below should be present
    type?: string;
    reference?: string;
    values?: Array<string | number>;
    // optionally extends;
    extend?: string;
    // a unhinged stretch to support nested and/or more than one choice/sequence/group
    variationGroup?: number[][][][][][][][][];
    // used in build-interfaces.ts to determine if there should a variation without this choice group of props
    choiceGroupOptional?: boolean;
}

export type ReferenceProp = Pick<
    Prop,
    'name' | 'required' | 'array' | 'choice' | 'isAttr' | 'reference' | 'extend'
>;

export type PrimitiveProp = Pick<
    Prop,
    'name' | 'required' | 'array' | 'choice' | 'isAttr' | 'type' | 'values'
>;

export interface Interface {
    name: string;
    props: Prop[];
    extend?: string;
}

interface Scope {
    choice: number;
    // inherited props only applies to direct children of the element (should not be inherited further down the tree)
    inherited?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    };
}

interface XsdElement extends Element {
    attributes: Attributes & AtLeast<{ name: string; ref: string }>;
}

class SchemaNotFoundError extends Error {
    constructor(public declaration: Element) {
        super(
            'Could not build interfaces. Reason: schema was not found in the provided xsd',
        );
    }
}

const asReferenceProp = (field: Interface & Prop): ReferenceProp => {
    const { name, required, reference, extend, choice } = field;
    return omitBy(
        { name, required, reference, extend, choice },
        isUndefined,
    ) as ReferenceProp;
};

const asPrimitiveProp = (field: Interface & Prop): PrimitiveProp => {
    const { name, required, type, values, choice } = field;
    return omitBy(
        { name, required, type, values, choice },
        isUndefined,
    ) as PrimitiveProp;
};

const asProp = (field: Interface & Prop): Prop => {
    const { name, required, reference, extend, type, values, choice } = field;
    return omitBy(
        { name, required, reference, extend, type, values, choice },
        isUndefined,
    ) as unknown as Prop;
};

const asInterface = (field: Interface & Prop): Interface => {
    const { name, props, extend } = field;
    return omitBy({ name, props, extend }, isUndefined) as unknown as Interface;
};

const createReferenceProp = (
    element: Element,
    scope: Scope | undefined,
): ReferenceProp => {
    return {
        name: String(element.attributes?.ref || element.attributes?.name),
        required: isRequired(element),
        array: isArray(element),
        choice: scope?.choice,
        reference: String(element.attributes?.ref || element.attributes?.name),
    };
};

const cleanType = (type: string | undefined) => {
    if (type?.includes('xsd:')) {
        return String(type.split('xsd:')[1]);
    }
    if (type === undefined || type === 'undefined') return 'definition';
    return type;
};

const isRequired = (element: Element): boolean => {
    if (type(element) === 'attribute') {
        // default false for attributes
        return element.attributes?.use === 'required';
    }

    // default true for others
    return (
        Boolean(Number(element.attributes?.minOccurs)) ||
        isNil(element.attributes?.minOccurs)
    );
};

const isArray = (element: Element): boolean => {
    // array if maxOccurs is unbounded or a number > 1
    return (
        element.attributes?.maxOccurs === 'unbounded' ||
        (Boolean(Number(element.attributes?.maxOccurs)) &&
            Number(element.attributes?.maxOccurs) > 1)
    );
};

const type = (element: Element): string => {
    return String(element.name?.split('xsd:')[1]);
};

const any = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    field.type = 'any';
    element.elements?.forEach(e =>
        processType(type(e), e, field, scope, declarations),
    );
};

const extension = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    const ref = String(element.attributes?.base);

    const native = ref.split('xsd:')[1];

    if (native) {
        field.extend = native;
    } else {
        field.extend = ref;
    }

    element.elements?.forEach(e =>
        processType(type(e), e, field, scope, declarations),
    );
};

const simpleContent = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    element.elements?.forEach(e =>
        processType(type(e), e, field, scope, declarations),
    );
};

const complexContent = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    element.elements?.forEach(e =>
        processType(type(e), e, field, scope, declarations),
    );
};

const enumeration = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    if (!field.values) {
        field.values = [];
    }
    field.values.push(String(element.attributes?.value));
    element.elements?.forEach(e =>
        processType(type(e), e, field, scope, declarations),
    );
};

const minLength = (element: Element, field: Prop) => {
    if (Number(element.attributes?.value) > 0) {
        field.required = true;
    }
};

const restriction = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    field.type =
        String(element.attributes?.base)?.split('xsd:')[1] ??
        (field.type && String(field.type)) ??
        (element.attributes?.base && String(element.attributes?.base));

    element.elements?.forEach(e =>
        processType(type(e), e, field, scope, declarations),
    );
};

const simpleType = (
    element: Element,
    parent: Interface,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    if (element.attributes?.name) {
        const field: Prop & Interface = {
            name: String(element.attributes.name!),
            required: isRequired(element),
            choice: scope?.choice,
            props: [],
        };

        if (element.attributes?.type) {
            field.type = cleanType(String(element.attributes?.type));
        }

        element.elements?.forEach(e =>
            processType(type(e), e, field, scope, declarations),
        );

        if (field.props.length) {
            parent.props.push(asReferenceProp(field));
            declarations.set(field.name, asInterface(field));
        } else {
            parent.props.push(asPrimitiveProp(field));
        }
    } else {
        element.elements?.forEach(e =>
            processType(type(e), e, parent, scope, declarations),
        );
    }
};

const complexType = (
    element: Element,
    parent: Interface,
    scope?: Scope,
    declarations?: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    if (element.attributes?.name) {
        parent.props.push(createReferenceProp(element, scope));
        const _interface: Interface = {
            name: element.attributes?.name as string,
            props: [],
        };

        element.elements?.forEach(e =>
            processType(type(e), e, _interface, scope, declarations),
        );

        declarations?.set(_interface.name, _interface);
    } else {
        element.elements?.forEach(e =>
            processType(type(e), e, parent, scope, declarations),
        );
    }
};

// review this thing
const group = (
    element: Element,
    parent: Interface,
    scope?: Scope,
    declarations?: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    if (element.attributes?.name) {
        // if it's being defined = we create the definition for it and add as prop to the parent
        parent.props.push(createReferenceProp(element, scope));
        const _interface: Interface = {
            name: element.attributes?.name as string,
            props: [],
        };

        element.elements?.forEach(e =>
            processType(type(e), e, _interface, scope, declarations),
        );

        declarations?.set(_interface.name, _interface);
    } else {
        // is being referenced
        element.elements?.forEach(e => {
            // actually this might never be the case, as groups cannot be defined (contain elements) inline (just defined in the root schema for later reference)
            // processType(type(e), e, parent, scope, declarations),
        });

        parent.props.push(createReferenceProp(element, scope));
    }
};

const sequence = (
    element: Element,
    field: Prop,
    scope?: Scope,
    declarations?: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    element.elements?.forEach(e =>
        processType(type(e), e, field, scope, declarations),
    );
};

const choice = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    // todo: solve inner choices edge-case
    // set it if there actually are elements in the choice if set without choices it will create unecessary permutations
    // if (element.elements?.length) {
    //     if (scope) {
    //         scope.choice = scope.choice || 0;
    //     } else {
    //         scope = { choice: 0 };
    //     }
    // }
    // element.elements?.forEach((e, i) => {
    //     scope.choice += 1;
    //     processType(type(e), e, field, scope, declarations);
    // });

    // choice block is entirely optional
    // if (!isRequired(element)) {
    //     field.choiceGroupOptional = true;
    // }

    element.elements?.forEach((e, i) =>
        processType(type(e), e, field, { ...scope, choice: i }, declarations, {
            choiceGroupOptional: !isRequired(element),
        }),
    );
};

const attribute = (
    element: Element,
    parent: Interface,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
) => {
    const attrField: Prop = {
        name: String(element.attributes?.name),
        required: isRequired(element),
        isAttr: true,
    };

    if (element.attributes?.type) {
        attrField.type = cleanType(String(element.attributes?.type));
    }

    if (element.elements) {
        element.elements.forEach(e =>
            processType(type(e), e, attrField, scope, declarations),
        );
    }

    parent.props.push(attrField);
};

const element = (
    element: XsdElement,
    parent: Interface,
    scope: Scope,
    declarations: Map<string, Interface>,
    inheritance?: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    },
): void | Prop => {
    if (element.attributes.ref) {
        parent.props.push(createReferenceProp(element, scope));
    } else {
        // element.attributes.name is necessarily present
        const field: Prop & Interface = {
            name: element.attributes.name!,
            required: isRequired(element),
            choice: scope?.choice,
            choiceGroupOptional: inheritance?.choiceGroupOptional,
            props: [],
        };

        if (element.attributes?.type) {
            field.type = cleanType(String(element.attributes?.type));
        }

        element.elements?.forEach(e =>
            processType(type(e), e, field, scope, declarations),
        );

        if (field.props.length) {
            // is an object rather than a primitive
            field.reference = field.name;
            // daten: Daten
            parent.props.push(asReferenceProp(field));
            declarations.set(field.name, asInterface(field));
        } else {
            // (likely) is a primitive
            parent.props.push(asProp(field));
        }
    }
};

const schema = (
    element: Element,
    parent?: Interface,
    scope?: Scope,
    declarations?: Map<string, Interface>,
    inheritance: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    } = {},
) => {
    const _interface: Interface = {
        name: 'schema',
        props: [],
    };

    declarations?.set(_interface.name, _interface);

    element.elements?.forEach(e =>
        processType(type(e), e, _interface, scope, declarations),
    );

    return _interface;
};

const processType = (
    type: string,
    _element: Element,
    parent: Interface | Prop,
    scope?: Scope,
    declarations?: Map<string, Interface>,
    inheritance: {
        optional?: boolean;
        array?: boolean;
        choiceGroupOptional?: boolean;
    } = {},
): Prop | void => {
    const processors = {
        schema,
        element,
        attribute,
        complexType,
        sequence,
        simpleType,
        restriction,
        enumeration,
        choice,
        extension,
        simpleContent,
        complexContent,
        minLength,
        any,
        group,
    };

    if (!(processors as any)[type]) {
        console.warn(`xsd type "${type}" does not have a processor yet.`);
    }
    return (processors as any)[type]?.(
        _element,
        parent,
        scope,
        declarations,
        inheritance,
    );
};

const toObject = (
    declarations: Map<string, Interface>,
): Record<string, Interface> => {
    const obj: Record<string, Interface> = {};

    for (const [name, declaration] of declarations.entries()) {
        obj[name] = declaration;
    }

    return obj;
};

const makeRootSchemaElementsNotRequired = (
    interfaces: Record<string, Interface>,
): Record<string, Interface> => {
    interfaces['schema'].props = interfaces['schema'].props.map(p => ({
        ...p,
        required: false,
    }));
    return interfaces;
};

export default (xsdFilePath: string): Record<string, Interface> => {
    const xsd = readFileSync(xsdFilePath, 'utf8');
    const options = { ignoreComment: true, alwaysChildren: true, trim: true };
    const root = <Element>xml2js(xsd, { ...options, compact: false });

    const schema = root.elements?.find(e => e.name === 'xsd:schema');

    // <xsd:include schemaLocation="http://www.gnpcb.org/esv/share/schemas/crossway.base.xsd"/>

    if (!schema) {
        throw new SchemaNotFoundError(root);
    }

    const declarations: Map<string, Interface> = new Map();

    // if schema references other schemas, we need to process them first
    const includes =
        schema.elements?.filter(e => e.name === 'xsd:include') || [];

    console.log(includes);

    const includedSchemas = includes.map(include => {
        const schemaLocation = include.attributes?.schemaLocation;
        if (!schemaLocation) {
            throw new Error(
                `Cannot process file ${xsdFilePath}. Reason: file includes a schema without 'schemaLocation' (<xsd:include schemaLocation="<expected this prop to be not empty or null>"/>). (Schema location: ${include.attributes?.schemaLocation})`,
            );
        }

        if (typeof schemaLocation === 'number') {
            throw new Error(
                `Cannot process file ${xsdFilePath}. Reason: file includes a schema whose location is a number whereas it should an URI. (Schema location: ${include.attributes?.schemaLocation})`,
            );
        }

        const isHttp =
            schemaLocation.startsWith('http://') ||
            schemaLocation.startsWith('https://');
        const isFilePath =
            /^(?![a-zA-Z]+:\/\/)(?:[a-zA-Z]:\\|\/)?(?:[^<>:"|?*\n\r]+[\\/])*[^<>:"|?*\n\r]*$/.test(
                schemaLocation,
            );

        switch (true) {
            case isHttp:
                return void fetch(schemaLocation)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(
                                `Cannot process file ${xsdFilePath}. Reason: the file includes a schema that could not be fetched. (Schema location: ${include.attributes?.schemaLocation})`,
                            );
                        }
                        return response.text();
                    })
                    .then(includedXsd => {
                        const includedRoot = <Element>(
                            xml2js(includedXsd, { ...options, compact: false })
                        );
                        const includedSchema = includedRoot.elements?.find(
                            e => e.name === 'xsd:schema',
                        );
                        if (!includedSchema) {
                            throw new SchemaNotFoundError(includedRoot);
                        }
                        console.log(
                            `Included schema: ${include.attributes?.schemaLocation}`,
                            includedSchema,
                        );
                        return includedSchema;
                    });
            case isFilePath:
                try {
                    const basePath = xsdFilePath
                        .split('/')
                        .slice(0, -1)
                        .join('/');
                    // simplistic handling of absolute and relative paths
                    const resolvedPath = schemaLocation.startsWith('/')
                        ? schemaLocation
                        : `${basePath}/${schemaLocation}`;
                    const includedXsd = readFileSync(resolvedPath, 'utf8');
                    const includedRoot = <Element>(
                        xml2js(includedXsd, { ...options, compact: false })
                    );
                    const includedSchema = includedRoot.elements?.find(
                        e => e.name === 'xsd:schema',
                    );
                    if (!includedSchema) {
                        throw new SchemaNotFoundError(includedRoot);
                    }
                    console.log(
                        `Included schema: ${include.attributes?.schemaLocation}`,
                        includedSchema,
                        includedSchema.elements?.[2],
                    );
                    return includedSchema;
                } catch (error) {
                    throw new Error(
                        `Cannot process file ${xsdFilePath}. Reason: the file includes a schema that could not be found. (Schema location: ${include.attributes?.schemaLocation})`,
                    );
                }
            default:
                throw new Error(
                    `Cannot process file ${xsdFilePath}. Reason: the file includes a schema using a not supported URI or protocol. Supported protocols are: http and file path. (Schema location: ${include.attributes?.schemaLocation})`,
                );
        }
    });
    console.log(`${schema.elements?.length} elements found in main schema.`);

    schema.elements = schema.elements || [];

    includedSchemas
        .filter(
            (includedSchema): includedSchema is Element =>
                !isNil(includedSchema),
        )
        .forEach(includedSchema => {
            // quirk for hipothetically massive arrays (100k+ elements) God forbid
            Array.prototype.push.apply(
                schema.elements,
                includedSchema.elements ?? [],
            );
            console.log(
                `Included schema: ${includedSchema.attributes?.targetNamespace}`,
                includedSchema,
                includedSchema.elements?.length,
                schema.elements?.length,
            );
        });

    processType(type(schema), schema, null!, undefined, declarations);

    const interfaces = toObject(declarations);

    makeRootSchemaElementsNotRequired(interfaces);

    return interfaces;
};
