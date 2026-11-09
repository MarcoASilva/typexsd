import { join } from 'path';
import ts from 'typescript';
import { SchemaOptions, compileXsd } from '../src/schema';
import { generateTypes } from '../src/codegen';
import type { GenerateOptions } from '../src/codegen';
import { CompiledSchema } from '../src/xsd/model';

export const XS = 'http://www.w3.org/2001/XMLSchema';

export const root = join(__dirname, '..');

/** Wrap schema components into a `<xs:schema>` document. */
export const schemaXml = (body: string, attrs = ''): string =>
    `<xs:schema xmlns:xs="${XS}"${
        attrs ? ' ' + attrs : ''
    }>${body}</xs:schema>`;

export interface CompileInput extends SchemaOptions {
    /** Extra attributes on `<xs:schema>`. */
    attrs?: string;
}

export const compile = (
    body: string,
    input: CompileInput = {},
): CompiledSchema => {
    const { attrs, ...options } = input;
    return compileXsd(schemaXml(body, attrs), options);
};

export const diagnosticCodes = (schema: CompiledSchema): string[] =>
    schema.diagnostics.map(d => d.code);

export const errorCodes = (schema: CompiledSchema): string[] =>
    schema.diagnostics.filter(d => d.severity === 'error').map(d => d.code);

export const generate = (
    body: string,
    input: CompileInput = {},
    options: GenerateOptions = {},
): string => generateTypes(compile(body, input), { header: false, ...options });

/** Compile the generated source with the TypeScript compiler and return its diagnostics. */
export const typecheck = (source: string): string[] => {
    const fileName = join(root, '__generated__.ts');
    const options: ts.CompilerOptions = {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2021,
        module: ts.ModuleKind.CommonJS,
        types: ['node'],
        typeRoots: [join(root, 'node_modules', '@types')],
    };
    const host = ts.createCompilerHost(options);
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (name, languageVersion, ...rest) =>
        name === fileName
            ? ts.createSourceFile(name, source, languageVersion)
            : original(name, languageVersion, ...rest);
    const originalExists = host.fileExists.bind(host);
    host.fileExists = name => name === fileName || originalExists(name);
    const program = ts.createProgram([fileName], options, host);
    return ts
        .getPreEmitDiagnostics(program)
        .map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
};
