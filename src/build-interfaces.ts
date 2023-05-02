import ts, { InterfaceDeclaration } from 'typescript';
import { pascalCase } from 'change-case';
import { isNil, max, range } from 'lodash';
import { writeFileSync } from 'fs';
import { Interface, Prop } from './extract-fields';

export const isPrimitive = (type: string) =>
    [
        'string',
        'boolean',
        'decimal',
        'int',
        'float',
        'double',
        'duration',
        'dateTime',
        'time',
        'date',
        'gYearMonth',
        'gYear',
        'gMonthDay',
        'gDay',
        'gMonth',
        'hexBinary',
        'base64Binary',
        'anyURI',
        'QName',
        'NOTATION',
        'positiveInteger',
        'any',
    ].includes(type);

const normalizePropName = (name: string): string => {
    return name.includes('-') ? `'${name}'` : name;
};

const hasVariations = (interfaceName: string, interfaces: Record<string, Interface>): boolean => {
    return interfaces[interfaceName]?.props.some(p => p.choice);
};

const getVariations = (interfaceName: string, interfaces: Record<string, Interface>): string[] => {
    const vs: Set<string> = new Set([interfaceName]);
    interfaces[interfaceName].props.forEach(prop => prop.choice && vs.add(`${interfaceName}${prop.choice}`));
    return [...vs];
};

const getPrimitive = (reference: string, schema: Interface): string | undefined => {
    const prop = schema.props.find(prop => prop.name === reference);
    if (!prop?.type) return;
    return isPrimitive(prop.type) ? prop.type : getPrimitive(prop?.type!, schema);
};

export const resolveType = (typeOrRef: string, interfaces: Record<string, Interface>): string | Array<string | number> => {
    if (isPrimitive(typeOrRef)) {
        return typeOrRef;
    }
    if (interfaces[typeOrRef]) return typeOrRef;

    const prop = interfaces['schema'].props.find(p => p.name === typeOrRef);

    if (!prop) {
        throw new Error('Could not resolve type:' + typeOrRef);
    }

    if (prop.values) {
        return prop.values;
    }

    if (prop.reference) {
        return resolveType(prop.reference, interfaces);
    }

    if (prop.type) {
        return resolveType(prop.type, interfaces);
    }

    throw new Error('Could not resolve type:' + typeOrRef);
};

const mapToTypeNode = (xsdType: string): ts.TypeNode => {
    switch (xsdType) {
        case 'string':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
        case 'dateTime':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
        case 'date':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
        case 'boolean':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
        case 'decimal':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case 'int':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case 'float':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case 'positiveInteger':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case 'base64Binary':
            return ts.factory.createTypeReferenceNode('Buffer');
        default:
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }
};

const buildInterfaces = (interfaces: Record<string, Interface>): void => {
    const declarations = Object.entries(interfaces)
        .map(([name, _interface]) => {
            const variations = Number(max(_interface.props.filter(prop => !Number.isNaN(prop.choice)).map(prop => prop.choice! + 1))) || 0 + 1;
            return range(0, variations).map(variation => {
                const propSignatures = _interface.props
                    .map(prop => {
                        let typeNode: ts.TypeNode;

                        // skip the props that are not suppoed to appear in this variation
                        if (!isNil(prop.choice) && prop.choice !== variation) return;

                        if (prop.values?.length) {
                            // if field has "values" like "modus"
                            // TODO: check for values type and create correct literal type (like numericLiteral instead of stringLiteral)
                            typeNode = ts.factory.createUnionTypeNode(
                                prop.values.map(value => ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(String(value)))),
                            );
                        } else {
                            if (!prop.reference && !prop.type) {
                                throw new Error(`A Prop should have either a "reference" or a "type" field. Prop ${prop.name} has none.`);
                            }
                            const resolvedType = resolveType((prop.reference || prop.type)!, interfaces);
                            if (Array.isArray(resolvedType)) {
                                typeNode = ts.factory.createUnionTypeNode(
                                    resolvedType.map(value => ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(String(value)))),
                                );
                            } else if (isPrimitive(resolvedType)) {
                                typeNode = mapToTypeNode(resolvedType);
                            } else if (hasVariations(resolvedType, interfaces)) {
                                typeNode = ts.factory.createUnionTypeNode(
                                    getVariations(resolvedType, interfaces).map(refName => ts.factory.createTypeReferenceNode(pascalCase(refName))) ?? [],
                                );
                            } else {
                                typeNode = ts.factory.createTypeReferenceNode(pascalCase(resolvedType));
                            }
                        }

                        return ts.factory.createPropertySignature(
                            undefined,
                            normalizePropName(prop.name),
                            prop.required ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
                            typeNode,
                        );
                    })
                    .filter(Boolean) as ts.PropertySignature[];

                let heritageClause;

                if (_interface.extend) {
                    // edge case where an element has children (elements or attrs) and a value itself
                    const type = resolveType(_interface.extend, interfaces);

                    if (Array.isArray(type)) throw new Error(`I'm not prepared for this. Should this happen?`);

                    if (isPrimitive(type)) {
                        // create a prop with the same name as the interface to hold the primitive value as a sibling prop of the other props for that interface
                        propSignatures.push(ts.factory.createPropertySignature(undefined, normalizePropName(_interface.name), undefined, mapToTypeNode(type)));
                    } else {
                        // const x = ts.factory.createFunctionExpression(
                        //     undefined,
                        //     undefined,
                        //     undefined,
                        //     undefined,
                        //     undefined,
                        //     undefined,
                        //     ts.factory.createBlock([ts.factory.createReturnStatement(ts.factory.createStringLiteral('Hello, world!'))]),
                        // );
                        const exp = ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier(pascalCase(_interface.extend)), []);
                        heritageClause = ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [exp]);
                    }
                }

                const interfaceName = pascalCase(variation ? `${_interface.name}${variation}` : _interface.name);

                // create the interface declaration
                const interfaceDeclaration = ts.factory.createInterfaceDeclaration(
                    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
                    interfaceName,
                    undefined,
                    heritageClause ? [heritageClause] : undefined,
                    propSignatures,
                );

                return interfaceDeclaration;
            });
        })
        .flat()
        .filter(Boolean) as ts.InterfaceDeclaration[];

    const newStatements = ts.factory.createNodeArray(declarations);

    // Create the AST node for the source file and add the variable and type alias declarations to it
    const sourceFile = ts.factory.createSourceFile(newStatements, ts.factory.createToken(ts.SyntaxKind.EndOfFileToken), ts.NodeFlags.None);
    const printer = ts.createPrinter();

    writeFileSync('interfaces.ts', printer.printFile(sourceFile));
};

export default buildInterfaces;
