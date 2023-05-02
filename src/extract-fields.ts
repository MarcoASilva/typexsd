import { readFileSync, writeFileSync } from "fs";
import { isNil, isUndefined, omitBy } from "lodash";
import { AtLeast } from "ts-toolbelt/out/Object/AtLeast";
import { xml2js, Element, Attributes } from "xml-js";

export interface Prop {
    name: string;
    required: boolean;
    choice?: number;
    isAttr?: boolean;
    // at least one of the three below should be present
    type?: string;
    reference?: string;
    values?: Array<string | number>;
    // optionally extends;
    extend?: string;
}

export type ReferenceProp = Pick<
    Prop,
    "name" | "required" | "choice" | "isAttr" | "reference" | "extend"
>;

export type PrimitiveProp = Pick<
    Prop,
    "name" | "required" | "choice" | "isAttr" | "type" | "values"
>;

export interface Interface {
    name: string;
    props: Prop[];
    extend?: string;
}

interface Scope {
    choice: number;
}

interface XsdElement extends Element {
    attributes: Attributes & AtLeast<{ name: string; ref: string }>;
}

class SchemaNotFoundError extends Error {
    constructor(public declaration: Element) {
        super(
            "Could not build interfaces. Reason: schema was not found in the provided xsd"
        );
    }
}

// export const isRef = (field: any): field is Ref => Boolean(field.ref);

const asReferenceProp = (field: Interface & Prop): ReferenceProp => {
    const { name, required, reference, extend, choice } = field;
    // return { name, required, reference, extend, choice };
    return omitBy(
        { name, required, reference, extend, choice },
        isUndefined
    ) as ReferenceProp;
};

const asPrimitiveProp = (field: Interface & Prop): PrimitiveProp => {
    const { name, required, type, values, choice } = field;
    // return { name, required, type, values, choice };
    return omitBy(
        { name, required, type, values, choice },
        isUndefined
    ) as PrimitiveProp;
};

const asProp = (field: Interface & Prop): Prop => {
    const { name, required, reference, extend, type, values, choice } = field;
    // return { name, required, reference, extend, type, values, choice };
    return omitBy(
        { name, required, reference, extend, type, values, choice },
        isUndefined
    ) as unknown as Prop;
};

const asInterface = (field: Interface & Prop): Interface => {
    const { name, props, extend } = field;
    // return field as Interface;
    // return { name, props, extend };
    return omitBy({ name, props, extend }, isUndefined) as unknown as Interface;
};

const createReferenceProp = (
    element: Element,
    scope: Scope | undefined
): ReferenceProp => {
    return {
        name: String(element.attributes?.ref || element.attributes?.name),
        required: isRequired(element),
        choice: scope?.choice,
        reference: String(element.attributes?.ref || element.attributes?.name),
    };
};

const isRequired = (element: Element): boolean => {
    if (type(element) === "attribute") {
        // default false for attributes
        return element.attributes?.use === "required";
    }

    // default true for others
    return (
        Boolean(Number(element.attributes?.minOccurs)) ||
        isNil(element.attributes?.minOccurs)
    );
};

const type = (element: Element): string => {
    return String(element.name?.split("xsd:")[1]);
};

const any = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>
) => {
    field.type = "any";
    element.elements?.forEach((e) =>
        processType(type(e), e, field, scope, declarations)
    );
};

const extension = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>
) => {
    const ref = String(element.attributes?.base);

    const native = ref.split("xsd:")[1];

    if (native) {
        field.extend = native;
    } else {
        field.extend = ref;
    }

    element.elements?.forEach((e) =>
        processType(type(e), e, field, scope, declarations)
    );
};

const simpleContent = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>
) => {
    element.elements?.forEach((e) =>
        processType(type(e), e, field, scope, declarations)
    );
};

const complexContent = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>
) => {
    element.elements?.forEach((e) =>
        processType(type(e), e, field, scope, declarations)
    );
};

const enumeration = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>
) => {
    if (!field.values) {
        field.values = [];
    }
    field.values.push(String(element.attributes?.value));
    element.elements?.forEach((e) =>
        processType(type(e), e, field, scope, declarations)
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
    declarations: Map<string, Interface>
) => {
    field.type =
        String(element.attributes?.base)?.split("xsd:")[1] ??
        (field.type && String(field.type)) ??
        (element.attributes?.base && String(element.attributes?.base));

    element.elements?.forEach((e) =>
        processType(type(e), e, field, scope, declarations)
    );
};

const simpleType = (
    element: Element,
    parent: Interface,
    scope: Scope,
    declarations: Map<string, Interface>
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

        element.elements?.forEach((e) =>
            processType(type(e), e, field, scope, declarations)
        );

        if (field.props.length) {
            parent.props.push(asReferenceProp(field));
            declarations.set(field.name, asInterface(field));
        } else {
            parent.props.push(asPrimitiveProp(field));
        }
    } else {
        element.elements?.forEach((e) =>
            processType(type(e), e, parent, scope, declarations)
        );
    }
};

const complexType = (
    element: Element,
    parent: Interface,
    scope?: Scope,
    declarations?: Map<string, Interface>
) => {
    if (element.attributes?.name) {
        parent.props.push(createReferenceProp(element, scope));
        const _interface: Interface = {
            name: element.attributes?.name as string,
            props: [],
        };

        element.elements?.forEach((e) =>
            processType(type(e), e, _interface, scope, declarations)
        );

        declarations?.set(_interface.name, _interface);

        // parent.props.push({
        //     name: _interface.name,
        //     required: isRequired(element),
        //     choice: scope?.choice,
        //     reference: _interface.name,
        // });
    } else {
        element.elements?.forEach((e) =>
            processType(type(e), e, parent, scope, declarations)
        );
    }
};

const sequence = (
    element: Element,
    field: Prop,
    scope?: Scope,
    declarations?: Map<string, Interface>
) => {
    element.elements?.forEach((e) =>
        processType(type(e), e, field, scope, declarations)
    );
};

const choice = (
    element: Element,
    field: Prop,
    scope: Scope,
    declarations: Map<string, Interface>
) => {
    element.elements?.forEach((e, i) =>
        processType(type(e), e, field, { ...scope, choice: i }, declarations)
    );
};
const cleanType = (type: string | undefined) => {
    if (type?.includes("xsd:")) {
        return String(type.split("xsd:")[1]);
    }
    if (type === undefined || type === "undefined") return "definition";
    return type;
};

const attribute = (
    element: Element,
    parent: Interface,
    scope: Scope,
    declarations: Map<string, Interface>
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
        element.elements.forEach((e) =>
            processType(type(e), e, attrField, scope, declarations)
        );
    }

    parent.props.push(attrField);
};

const element = (
    element: XsdElement,
    parent: Interface,
    scope: Scope,
    declarations: Map<string, Interface>
): void | Prop => {
    if (element.attributes.ref) {
        // parent.props.push({
        //     name: String(element.attributes?.ref),
        //     required: isRequired(element),
        //     choice: scope?.choice,
        //     reference: String(element.attributes.ref),
        // });
        parent.props.push(createReferenceProp(element, scope));
    } else {
        // element.attributes.name is necessarily present
        const field: Prop & Interface = {
            name: element.attributes.name!,
            required: isRequired(element),
            choice: scope?.choice,
            props: [],
        };

        if (element.attributes?.type) {
            field.type = cleanType(String(element.attributes?.type));
        }

        element.elements?.forEach((e) =>
            processType(type(e), e, field, scope, declarations)
        );

        if (field.props.length) {
            field.reference = field.name;
            parent.props.push(asReferenceProp(field));
            declarations.set(field.name, asInterface(field));
        } else {
            // const { name, required, choice, type, values } = field;
            parent.props.push(asProp(field));
        }
    }
};

const definitions = (root: Interface) => {
    root.props?.forEach((f) => {
        f.required = false;
    });
};

const schema = (
    element: Element,
    parent?: Interface,
    scope?: Scope,
    declarations?: Map<string, Interface>
) => {
    const _interface: Interface = {
        name: "schema",
        props: [],
    };

    declarations?.set(_interface.name, _interface);

    element.elements?.forEach((e) =>
        processType(type(e), e, _interface, scope, declarations)
    );
    // definitions(_schema);

    return _interface;
};

const processType = (
    type: string,
    _element: Element,
    parent: Interface | Prop,
    scope?: Scope,
    declarations?: Map<string, Interface>
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
    };

    return (processors as any)[type]?.(_element, parent, scope, declarations);
};

const toObject = (
    declarations: Map<string, Interface>
): Record<string, Interface> => {
    const obj: Record<string, Interface> = {};

    for (const [name, declaration] of declarations.entries()) {
        obj[name] = declaration;
    }

    return obj;
};

const makeSchemaElementsNotRequired = (
    interfaces: Record<string, Interface>
): Record<string, Interface> => {
    interfaces["schema"].props = interfaces["schema"].props.map((p) => ({
        ...p,
        required: false,
    }));
    return interfaces;
};

export default (xsdFilePath: string) => {
    const xsd = readFileSync(xsdFilePath, "utf8");
    const options = { ignoreComment: true, alwaysChildren: true, trim: true };
    const root = <Element>xml2js(xsd, { ...options, compact: false });

    const schema = root.elements?.find((e) => e.name === "xsd:schema");

    if (!schema) {
        throw new SchemaNotFoundError(root);
    }

    const declarations: Map<string, Interface> = new Map();

    processType(type(schema), schema, null!, undefined, declarations);

    const interfaces = toObject(declarations);

    makeSchemaElementsNotRequired(interfaces);

    writeFileSync("interfaces.json", JSON.stringify(interfaces));

    return interfaces;
};
