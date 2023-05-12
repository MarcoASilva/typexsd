import { isNil } from 'lodash';
import { ElementCompact, xml2js } from 'xml-js';
import { isPrimitive, resolveType } from '../codegen/build-interfaces';
import { Interface } from '../codegen/extract-fields';

interface PrimitivesParser {
    parsePrimitives(): Record<string, any>;
}

const JSPrimitiveType = (xsdType: string): string => {
    const map: Record<string, string> = {
        string: 'string',
        date: 'string',
        dateTime: 'string',
        boolean: 'boolean',
        decimal: 'number',
        int: 'number',
        float: 'number',
        positiveInteger: 'number',
        base64Binary: 'object',
    };

    return map[xsdType];
};

const conform = (obj: ElementCompact, objName: string) => {
    if (!isNil(obj._text)) {
        if (Object.keys(obj).length === 1) return obj._text;

        obj[objName] = obj._text;
        delete obj._text;
    }

    if (obj._attributes) {
        Object.assign(obj, obj._attributes);
        delete obj._attributes;
    }

    for (const prop in obj) {
        if (typeof obj[prop] === 'object') {
            if (!Object.keys(obj[prop]).length) {
                // assuming every empty object is a string with no value in the xml
                // (as only strings allow for valid empty elements)
                obj[prop] = '';
                continue;
            }

            obj[prop] = conform(obj[prop], prop);
        }
    }
    return obj;
};

const defaultPrimitiveParser = (obj: Record<string, any>): PrimitivesParser => {
    const parseVal = (val: string): boolean | number | string => {
        try {
            return JSON.parse(val);
        } catch (e) {
            return val;
        }
    };

    const parsePrimitives = (
        _obj: Record<string, any> = obj,
    ): Record<string, any> => {
        return Object.entries(_obj)
            .map(([key, val]) => {
                if (typeof val === 'string') return [key, parseVal(val)];
                if (typeof val === 'object') return [key, parsePrimitives(val)];
                return [key, val];
            })
            .reduce((newObj, [key, val]) => ({ ...newObj, [key]: val }), {});
    };

    return { parsePrimitives };
};

const schemaCompliantPrimitivesParser = (
    obj: Record<string, any>,
    objName: string,
    interfaces: Record<string, Interface>,
): PrimitivesParser => {
    const findType = (path: string) => {
        const [interfaceName, ...rest] = path.split('.');

        let currentDefinition: Interface = interfaces[interfaceName];

        for (const part of rest) {
            const p = currentDefinition.props.find(p => p.name === part);

            if (!p) throw new Error(`Property not found ${path}`);

            const type = resolveType((p.type || p.reference)!, interfaces);

            // bad... assuming string but could be number also
            if (Array.isArray(type)) return 'string';

            if (isPrimitive(type)) return JSPrimitiveType(type);

            currentDefinition = interfaces[type];
        }

        return currentDefinition.name;
    };

    const parseVal = (path: string, val: string): boolean | number | string => {
        const type = findType(path);

        if (type === 'number' || type === 'boolean') {
            try {
                return JSON.parse(val);
            } catch (e) {
                return val;
            }
        }

        return val;
    };

    const parsePrimitives = (
        _obj: Record<string, any> = obj,
        path: string = objName,
    ): Record<string, any> => {
        return Object.entries(_obj)
            .map(([key, val]) => {
                if (typeof val === 'string')
                    return [key, parseVal(`${path}.${key}`, val)];
                if (typeof val === 'object')
                    return [key, parsePrimitives(val, `${path}.${key}`)];
                return [key, val];
            })
            .reduce((newObj, [key, val]) => ({ ...newObj, [key]: val }), {});
    };

    return { parsePrimitives };
};

export const parse = <T = Record<string, any>>(
    xml: string,
    interfaces?: Record<string, Interface>,
): T => {
    const root = xml2js(xml, {
        ignoreComment: true,
        compact: true,
        ignoreDeclaration: true,
        nativeType: true,
    });

    if (Object.keys(root).length > 1)
        throw new Error('XML with multiple root elements not supported');

    const [[name]] = Object.entries(root);

    const parsed = conform(
        (root as Record<string, ElementCompact>)[name],
        name,
    ) as Record<string, any>;

    if (interfaces) {
        return schemaCompliantPrimitivesParser(
            parsed,
            name,
            interfaces,
        ).parsePrimitives() as T;
    }

    return defaultPrimitiveParser(parsed).parsePrimitives() as T;
};
