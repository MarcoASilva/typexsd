import { SchemaOptions, loadSchemaSync } from '../schema';
import { CompiledSchema, ElementDecl } from '../xsd/model';
import { globalElementKeys } from '../xsd/view';
import { qkey } from '../xsd/names';

export type SchemaSource = string | CompiledSchema;

export const resolveSchema = (
    source: SchemaSource,
    options?: SchemaOptions,
): CompiledSchema =>
    typeof source === 'string' ? loadSchemaSync(source, options) : source;

/** Find a global element by its property name (as in the generated `Schema`), local name or `{ns}local`. */
export const findGlobalElement = (
    schema: CompiledSchema,
    name: string,
): ElementDecl | undefined =>
    globalElementKeys(schema.elements.values()).get(name) ??
    schema.elements.get(name) ??
    [...schema.elements.values()].find(
        d => qkey(d.name) === name || d.name.local === name,
    );

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Uint8Array);
