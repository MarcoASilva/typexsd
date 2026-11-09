import { CompiledSchema } from '../xsd/model';
import { DEFAULT_HEADER, GenerateOptions, generateDeclarations } from './map';
import { printDeclarations } from './print';

export { generateDeclarations } from './map';
export type { GenerateOptions } from './map';
export { printDeclarations } from './print';
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
