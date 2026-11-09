import { CompileOptions, compileSchemaSet } from './xsd/compile';
import {
    LoadOptions,
    SchemaEntry,
    loadSchemaSet,
    loadSchemaSetSync,
} from './xsd/loader';
import { CompiledSchema } from './xsd/model';

export type SchemaOptions = LoadOptions & CompileOptions;

/**
 * Load, interpret and compile an XSD (and everything it includes or imports)
 * synchronously. Remote schemas need `urlMap`/`localFallback`/`sources`; use
 * `loadSchema` to fetch them over HTTP.
 */
export const loadSchemaSync = (
    entry: SchemaEntry,
    options: SchemaOptions = {},
): CompiledSchema =>
    compileSchemaSet(loadSchemaSetSync(entry, options), options);

/** Like `loadSchemaSync`, but remote `http(s)` schemas are fetched. */
export const loadSchema = async (
    entry: SchemaEntry,
    options: SchemaOptions = {},
): Promise<CompiledSchema> =>
    compileSchemaSet(await loadSchemaSet(entry, options), options);

/** Compile an XSD given as text. Relative includes resolve through `options.sources`. */
export const compileXsd = (
    xsd: string,
    options: SchemaOptions = {},
): CompiledSchema =>
    loadSchemaSync({ location: 'schema.xsd', text: xsd }, options);
