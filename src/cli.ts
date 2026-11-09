#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { generateTypes } from './codegen';
import { formatDiagnostic } from './xsd/diagnostics';
import { loadSchema } from './schema';

const USAGE = `typexsd - type-safe XML builder and parser for XSD

Usage:
  typexsd generate <schema.xsd> [options]

Options:
  --out <file>            Output file (default: interfaces.ts)
  --map <url=path>        Load a remote schemaLocation from a local file (repeatable)
  --local-fallback        For unmapped remote includes, look for the same file name next to the including schema
  --type <xsd=ts>         Override the TypeScript type of a built-in datatype, e.g. --type dateTime=Date (repeatable)
  --root <name>           Name of the root interface (default: Schema)
  --doc-lang <lang>       Preferred documentation language (default: en)
  --no-docs               Do not emit XSD documentation as TSDoc
  --strict                Fail on any schema error
  --quiet                 Do not print diagnostics
  -h, --help              Show this help
`;

interface Args {
    command?: string;
    input?: string;
    out: string;
    map: Record<string, string>;
    typeMap: Record<string, string>;
    localFallback: boolean;
    root?: string;
    docLang?: string;
    docs: boolean;
    strict: boolean;
    quiet: boolean;
    help: boolean;
}

const parseArgs = (argv: string[]): Args => {
    const args: Args = {
        out: 'interfaces.ts',
        map: {},
        typeMap: {},
        localFallback: false,
        docs: true,
        strict: false,
        quiet: false,
        help: false,
    };
    const positional: string[] = [];
    const value = (i: number, flag: string): string => {
        const v = argv[i + 1];
        if (v === undefined) throw new Error(`${flag} needs a value`);
        return v;
    };
    const pair = (raw: string, flag: string): [string, string] => {
        const at = raw.lastIndexOf('=');
        if (at <= 0)
            throw new Error(`${flag} expects <key>=<value>, got "${raw}"`);
        return [raw.slice(0, at), raw.slice(at + 1)];
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--out':
                args.out = value(i++, arg);
                break;
            case '--map': {
                const [k, v] = pair(value(i++, arg), arg);
                args.map[k] = v;
                break;
            }
            case '--type': {
                const [k, v] = pair(value(i++, arg), arg);
                args.typeMap[k] = v;
                break;
            }
            case '--root':
                args.root = value(i++, arg);
                break;
            case '--doc-lang':
                args.docLang = value(i++, arg);
                break;
            case '--local-fallback':
                args.localFallback = true;
                break;
            case '--no-docs':
                args.docs = false;
                break;
            case '--strict':
                args.strict = true;
                break;
            case '--quiet':
                args.quiet = true;
                break;
            case '-h':
            case '--help':
                args.help = true;
                break;
            default:
                if (arg.startsWith('-'))
                    throw new Error(`Unknown option ${arg}`);
                positional.push(arg);
        }
    }
    [args.command, args.input] = positional;
    return args;
};

export interface Io {
    log(message: string): void;
    error(message: string): void;
}

/** Run the CLI. Returns the process exit code. */
export const run = async (
    argv: string[],
    io: Io = { log: console.log, error: console.error },
): Promise<number> => {
    let args: Args;
    try {
        args = parseArgs(argv);
    } catch (error) {
        io.error((error as Error).message);
        io.error(USAGE);
        return 2;
    }

    if (args.help || !args.command) {
        io.log(USAGE);
        return args.help ? 0 : 2;
    }
    if (args.command !== 'generate' || !args.input) {
        io.error(USAGE);
        return 2;
    }

    const schema = await loadSchema(args.input, {
        urlMap: args.map,
        localFallback: args.localFallback,
        strict: args.strict,
    });

    if (!args.quiet)
        for (const d of schema.diagnostics)
            if (d.severity !== 'info') io.error(formatDiagnostic(d));

    const source = generateTypes(schema, {
        docs: args.docs,
        docLang: args.docLang,
        typeMap: args.typeMap,
        rootName: args.root,
    });
    writeFileSync(args.out, source);
    if (!args.quiet) io.error(`Wrote ${args.out}`);
    return 0;
};

if (
    typeof require !== 'undefined' &&
    typeof module !== 'undefined' &&
    require.main === module
) {
    run(process.argv.slice(2)).then(
        code => process.exit(code),
        error => {
            console.error(error instanceof Error ? error.message : error);
            process.exit(1);
        },
    );
}
