import { CompiledSchema } from '../xsd/model';
import { DEFAULT_HEADER, GenerateOptions, generateDeclarations } from './map';
import { printDeclarations } from './print';
import { printZodDeclarations } from './print-zod';

export { generateDeclarations } from './map';
export type { GenerateOptions } from './map';
export { printDeclarations } from './print';
export { printZodDeclarations } from './print-zod';
export type { PrintZodOptions } from './print-zod';
export type * from './ir';

/** Generate the TypeScript source for a compiled schema. */
export const generateTypes = (
    schema: CompiledSchema,
    options: GenerateOptions = {},
): string => {
    const header =
        options.header === false ? undefined : options.header ?? DEFAULT_HEADER;
    return printDeclarations(generateDeclarations(schema, options), header);
};

/** Generate Zod schemas that structurally twin the TypeScript types. */
export const generateZod = (
    schema: CompiledSchema,
    options: GenerateOptions = {},
): string => {
    const header =
        options.header === false ? undefined : options.header ?? DEFAULT_HEADER;
    return printZodDeclarations(generateDeclarations(schema, options), {
        header,
        encodeFacets: options.encodeFacets,
    });
};
