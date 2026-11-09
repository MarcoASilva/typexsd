import ts from 'typescript';
import { TsDecl, TsDoc, TsMember, TsType } from './ir';

const f = ts.factory;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const propertyName = (name: string): ts.PropertyName =>
    IDENTIFIER.test(name)
        ? f.createIdentifier(name)
        : f.createStringLiteral(name, true);

const toTypeNode = (type: TsType): ts.TypeNode => {
    switch (type.k) {
        case 'keyword':
            return f.createKeywordTypeNode(
                {
                    string: ts.SyntaxKind.StringKeyword,
                    number: ts.SyntaxKind.NumberKeyword,
                    boolean: ts.SyntaxKind.BooleanKeyword,
                    unknown: ts.SyntaxKind.UnknownKeyword,
                    never: ts.SyntaxKind.NeverKeyword,
                }[type.name] as ts.KeywordTypeSyntaxKind,
            );
        case 'null':
            return f.createLiteralTypeNode(f.createNull());
        case 'ref':
            return f.createTypeReferenceNode(type.name);
        case 'literal': {
            const v = type.value;
            if (typeof v === 'string')
                return f.createLiteralTypeNode(f.createStringLiteral(v, true));
            if (typeof v === 'boolean')
                return f.createLiteralTypeNode(
                    v ? f.createTrue() : f.createFalse(),
                );
            return f.createLiteralTypeNode(
                v < 0
                    ? f.createPrefixUnaryExpression(
                          ts.SyntaxKind.MinusToken,
                          f.createNumericLiteral(String(-v)),
                      )
                    : f.createNumericLiteral(String(v)),
            );
        }
        case 'array': {
            const inner = toTypeNode(type.of);
            const needsParens =
                type.of.k === 'union' || type.of.k === 'intersection';
            return f.createArrayTypeNode(
                needsParens ? f.createParenthesizedType(inner) : inner,
            );
        }
        case 'union':
            return f.createUnionTypeNode(
                type.types.map(t => {
                    const node = toTypeNode(t);
                    return t.k === 'intersection'
                        ? f.createParenthesizedType(node)
                        : node;
                }),
            );
        case 'intersection':
            return f.createIntersectionTypeNode(
                type.types.map(t => {
                    const node = toTypeNode(t);
                    return t.k === 'union'
                        ? f.createParenthesizedType(node)
                        : node;
                }),
            );
        case 'object': {
            const members = membersOf(type.members, type.index);
            const node = f.createTypeLiteralNode(members);
            if (members.length === 0)
                ts.setEmitFlags(node, ts.EmitFlags.SingleLine);
            return node;
        }
    }
};

const docText = (doc: TsDoc): string | undefined => {
    const lines: string[] = [];
    for (const [i, paragraph] of doc.text.entries()) {
        if (i > 0) lines.push('');
        lines.push(...paragraph.split('\n'));
    }
    lines.push(...doc.tags);
    const cleaned = lines.map(l => l.replace(/\*\//g, '*\\/').trimEnd());
    if (!cleaned.some(l => l.trim())) return undefined;
    return `*\n${cleaned.map(l => (l ? ` * ${l}` : ' *')).join('\n')}\n `;
};

const withDoc = <T extends ts.Node>(node: T, doc?: TsDoc): T => {
    const text = doc ? docText(doc) : undefined;
    if (text)
        ts.addSyntheticLeadingComment(
            node,
            ts.SyntaxKind.MultiLineCommentTrivia,
            text,
            true,
        );
    return node;
};

const indexSignature = (type: TsType): ts.IndexSignatureDeclaration =>
    f.createIndexSignature(
        undefined,
        [
            f.createParameterDeclaration(
                undefined,
                undefined,
                'key',
                undefined,
                f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            ),
        ],
        toTypeNode(type),
    );

const membersOf = (members: TsMember[], index?: TsType): ts.TypeElement[] => {
    const result: ts.TypeElement[] = members.map(m =>
        withDoc(
            f.createPropertySignature(
                undefined,
                propertyName(m.name),
                m.optional
                    ? f.createToken(ts.SyntaxKind.QuestionToken)
                    : undefined,
                toTypeNode(m.type),
            ),
            m.doc,
        ),
    );
    if (index) result.push(indexSignature(index));
    return result;
};

const toStatement = (decl: TsDecl): ts.Statement => {
    const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];
    if (decl.k === 'alias')
        return withDoc(
            f.createTypeAliasDeclaration(
                exportModifier,
                decl.name,
                undefined,
                toTypeNode(decl.type),
            ),
            decl.doc,
        );
    return withDoc(
        f.createInterfaceDeclaration(
            exportModifier,
            decl.name,
            undefined,
            decl.extends.length
                ? [
                      f.createHeritageClause(
                          ts.SyntaxKind.ExtendsKeyword,
                          decl.extends.map(name =>
                              f.createExpressionWithTypeArguments(
                                  f.createIdentifier(name),
                                  undefined,
                              ),
                          ),
                      ),
                  ]
                : undefined,
            membersOf(decl.members, decl.index),
        ),
        decl.doc,
    );
};

/** Print declarations as a TypeScript source file. */
export const printDeclarations = (decls: TsDecl[], header?: string): string => {
    const statements = f.createNodeArray(decls.map(toStatement));
    const sourceFile = f.createSourceFile(
        statements,
        f.createToken(ts.SyntaxKind.EndOfFileToken),
        ts.NodeFlags.None,
    );
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const body = printer.printFile(sourceFile);
    return header ? `${header}\n\n${body}` : body;
};
