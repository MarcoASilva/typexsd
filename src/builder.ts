import xmlbuilder from 'xmlbuilder';
import { isNil } from 'lodash';
import extractFields, { Interface, Prop } from './extract-fields';
import { readFileSync } from 'fs';
import { isPrimitive, resolveType } from './build-interfaces';

export interface Target {
    declarationsPath?: string;
    xsdFilePath?: string;
}

export type Builder = <T extends keyof U, U>(data: U, elementName: T) => string;

const loadExtensions = (intrfc: Interface, interfaces: Record<string, Interface>): Interface => {
    if (!intrfc.extend) return intrfc;
    const base: Interface | Prop | undefined = interfaces[intrfc.extend] ?? interfaces['schema'].props.find(({ name }) => name === intrfc.extend);
    if (!base) {
        throw new Error(`Could not find type ${intrfc.extend} to extend.`);
    }
    const extended: Interface | Prop = { ...base, ...intrfc };
    if (isPrimitive((extended as unknown as Prop).type!)) {
        extended.props.push({
            name: intrfc.name,
            required: true,
            type: (extended as unknown as Prop).type!,
        });
    }
    return extended;
};

const populate = (parent: xmlbuilder.XMLElement, prop: Prop, parentData: any, interfaces: Record<string, Interface>) => {
    const data = parentData[prop.name];

    if (isNil(data)) return;

    if (prop.isAttr) {
        return parent.att(prop.name, data);
    }

    const element = parent.ele(prop.name);

    // work around for duplicate fields (once fields are generated with some duplicates)
    parentData[prop.name] = undefined;

    const type = resolveType((prop.reference || prop.type)!, interfaces);

    if (interfaces[type as string]) {
        // -> load extensions before: may add new props
        loadExtensions(interfaces[prop.type as string], interfaces).props.forEach(p => populate(element, p, data, interfaces));
    } else {
        element.text(data);
    }

    return element;
};

const populateProp = (parent: xmlbuilder.XMLElement, prop: Prop, parentData: any, interfaces: Record<string, Interface>) => {
    const data = parentData[prop.name];

    if (isNil(data)) return;

    if (prop.isAttr) {
        return parent.att(prop.name, data);
    }

    const element = parent.ele(prop.name);

    // work around for duplicate fields (once fields are generated with some duplicates)
    // parentData[prop.name] = undefined;

    const type = resolveType((prop.reference || prop.type)!, interfaces);

    if (Array.isArray(type)) throw new Error('Wtf?? Should this happen?');

    if (isPrimitive(type)) {
        return element.text(data);
    }

    if (interfaces[type]) {
        populateInterface(element, interfaces[type], parentData, interfaces);
    }

    return element;
};

const populateInterface = (element: xmlbuilder.XMLElement, intrfc: Interface, parentData: any, interfaces: Record<string, Interface>) => {
    const data = parentData[intrfc.name];

    loadExtensions(intrfc, interfaces).props.forEach(p => populateProp(element, p, data, interfaces));
};

export const build = <T extends keyof U, U>({ declarationsPath, xsdFilePath }: Target, data: U, elementName: T): string => {
    let interfaces: Record<string, Interface>;

    if (declarationsPath) {
        interfaces = JSON.parse(readFileSync(declarationsPath).toString());
    } else if (xsdFilePath) {
        interfaces = extractFields(xsdFilePath);
    } else {
        throw new Error('Cannot build XML. Neither "declarationsPath" nor "xsdFilePath" was provided. At least one is required.');
    }

    const intrfc = interfaces[elementName as string];

    if (!intrfc) {
        throw new Error(`${String(elementName)} not found in xsd fields`);
    }

    const root = xmlbuilder.create(intrfc.name);

    populateInterface(root, intrfc, data, interfaces);

    return root.end({ pretty: true });
};

export const createBuilder = (target: Target): Builder => build.bind(build, target) as Builder;
