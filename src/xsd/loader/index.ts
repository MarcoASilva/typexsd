import { existsSync, readFileSync } from 'fs';
import { basename, dirname, isAbsolute, resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';
import { posix } from 'path';
import { XmlElement, XmlSyntaxError, decodeXml, parseXml } from '../dom';
import { DiagnosticBag } from '../diagnostics';
import { XML_NS, XSD_NS } from '../names';
import {
    RawImport,
    RawInclude,
    RawOverride,
    RawRedefine,
    RawSchema,
    buildSchemaDocument,
} from '../rules';

export interface LoadOptions {
    /**
     * Map a `schemaLocation` (typically a remote URL) to a local file path or
     * another location. Either a lookup table or a function.
     */
    urlMap?:
        | Record<string, string>
        | ((location: string) => string | undefined);
    /**
     * For remote locations without a mapping, also try a file with the same
     * base name next to the including schema.
     */
    localFallback?: boolean;
    /** In-memory documents keyed by location, consulted before the filesystem. */
    sources?: Record<string, string>;
    /** `fetch` implementation for remote schemas (async loading only). */
    fetch?: typeof fetch;
    /** Collect diagnostics into an existing bag. */
    diagnostics?: DiagnosticBag;
}

export type SchemaLinkKind = 'include' | 'import' | 'redefine' | 'override';

export interface SchemaLink {
    kind: SchemaLinkKind;
    raw: RawInclude | RawImport | RawRedefine | RawOverride;
    /** Resolved location, when the link has a `schemaLocation`. */
    location?: string;
    /** Loaded target document. */
    target?: SchemaDocument;
}

export interface SchemaDocument {
    key: string;
    location: string;
    /** Effective target namespace (a chameleon include adopts its includer's). */
    targetNamespace: string;
    chameleon: boolean;
    raw: RawSchema;
    links: SchemaLink[];
}

export interface SchemaSet {
    entry: SchemaDocument;
    /** Every loaded document, entry first, in discovery order. */
    documents: SchemaDocument[];
    diagnostics: DiagnosticBag;
}

export type SchemaEntry = string | { location: string; text: string };

// -----------------------------------------------------------------------------
// location handling
// -----------------------------------------------------------------------------

const isRemote = (location: string): boolean => /^https?:\/\//i.test(location);

export const resolveLocation = (
    schemaLocation: string,
    base: string,
): string => {
    if (isRemote(schemaLocation)) return schemaLocation;
    if (schemaLocation.startsWith('file:'))
        return fileURLToPath(schemaLocation);
    if (isRemote(base)) return new URL(schemaLocation, base).href;
    if (isAbsolute(schemaLocation)) return schemaLocation;
    // a relative base means an in-memory document (see `LoadOptions.sources`)
    if (!isAbsolute(base))
        return posix.normalize(posix.join(posix.dirname(base), schemaLocation));
    return resolvePath(dirname(base), schemaLocation);
};

type ReadPlan =
    | { kind: 'text'; text: string }
    | { kind: 'file'; path: string }
    | { kind: 'remote'; url: string }
    | { kind: 'fail'; message: string };

const planRead = (
    location: string,
    from: string | undefined,
    options: LoadOptions,
): ReadPlan => {
    const { sources, urlMap } = options;

    let target = location;
    const mapped =
        typeof urlMap === 'function' ? urlMap(location) : urlMap?.[location];
    if (mapped) target = mapped;

    if (sources) {
        const candidates = [
            target,
            location,
            posix.normalize(target),
            from ? posix.join(posix.dirname(from), target) : target,
        ];
        for (const c of candidates)
            if (c in sources) return { kind: 'text', text: sources[c] };
    }

    if (isRemote(target)) {
        if (options.localFallback && from && !isRemote(from)) {
            const candidate = resolvePath(
                dirname(from),
                basename(new URL(target).pathname),
            );
            if (existsSync(candidate)) return { kind: 'file', path: candidate };
        }
        return { kind: 'remote', url: target };
    }

    const path = target.startsWith('file:') ? fileURLToPath(target) : target;
    if (!existsSync(path))
        return { kind: 'fail', message: `file not found: ${path}` };
    return { kind: 'file', path };
};

interface ReadResult {
    text?: string;
    error?: string;
}

const readSync = (plan: ReadPlan): ReadResult => {
    switch (plan.kind) {
        case 'text':
            return { text: plan.text };
        case 'file':
            try {
                return { text: decodeXml(readFileSync(plan.path)) };
            } catch (error) {
                return { error: (error as Error).message };
            }
        case 'remote':
            return {
                error: `remote schema ${plan.url} cannot be loaded synchronously; use loadSchema() (async), provide "urlMap"/"localFallback", or pre-download it`,
            };
        default:
            return { error: plan.message };
    }
};

const readAsync = async (
    plan: ReadPlan,
    options: LoadOptions,
): Promise<ReadResult> => {
    if (plan.kind !== 'remote') return readSync(plan);
    const doFetch = options.fetch ?? (globalThis as any).fetch;
    if (!doFetch)
        return {
            error: `no fetch implementation available to load ${plan.url}`,
        };
    try {
        const response = await doFetch(plan.url);
        if (!response.ok)
            return {
                error: `HTTP ${response.status} while fetching ${plan.url}`,
            };
        return {
            text: decodeXml(new Uint8Array(await response.arrayBuffer())),
        };
    } catch (error) {
        return {
            error: `could not fetch ${plan.url}: ${(error as Error).message}`,
        };
    }
};

// -----------------------------------------------------------------------------
// graph walk (shared by the sync and async drivers)
// -----------------------------------------------------------------------------

interface ReadRequest {
    plan: ReadPlan;
}

interface QueueItem {
    location: string;
    from?: string;
    /** Namespace of the including schema (include/redefine/override only). */
    includerNs?: string;
    /** Declared namespace on an import. */
    importNs?: string;
    kind?: SchemaLinkKind;
    link?: SchemaLink;
    owner?: SchemaDocument;
}

function* walk(
    entry: SchemaEntry,
    options: LoadOptions,
    diagnostics: DiagnosticBag,
): Generator<ReadRequest, SchemaSet, ReadResult> {
    const entryLocation =
        typeof entry === 'string'
            ? isRemote(entry)
                ? entry
                : options.sources && entry in options.sources
                ? entry
                : resolvePath(entry)
            : entry.location;

    const texts = new Map<string, string | null>();
    const roots = new Map<string, XmlElement | null>();
    const documents = new Map<string, SchemaDocument>();
    const ordered: SchemaDocument[] = [];
    const pending: Array<{ doc: SchemaDocument; link: SchemaLink }> = [];

    if (typeof entry !== 'string') texts.set(entryLocation, entry.text);

    const queue: QueueItem[] = [{ location: entryLocation }];

    while (queue.length) {
        const item = queue.shift()!;

        // -- text -------------------------------------------------------------
        if (!texts.has(item.location)) {
            const plan = planRead(item.location, item.from, options);
            const result: ReadResult = yield { plan };
            if (result.text === undefined) {
                diagnostics.error(
                    'schema-load-failed',
                    `could not load schema "${item.location}": ${
                        result.error ?? 'unknown error'
                    }`,
                    undefined,
                    item.from,
                );
                texts.set(item.location, null);
            } else {
                texts.set(item.location, result.text);
            }
        }
        const text = texts.get(item.location);
        if (text === null || text === undefined) continue;

        // -- parse ------------------------------------------------------------
        if (!roots.has(item.location)) {
            try {
                roots.set(item.location, parseXml(text, item.location));
            } catch (error) {
                if (!(error instanceof XmlSyntaxError)) throw error;
                diagnostics.error(
                    'schema-malformed',
                    error.message,
                    undefined,
                    item.location,
                );
                roots.set(item.location, null);
            }
        }
        const root = roots.get(item.location);
        if (!root) continue;

        // -- chameleon detection ----------------------------------------------
        const declaresNs = root.attr('targetNamespace') !== undefined;
        const chameleonNs =
            !declaresNs && item.includerNs ? item.includerNs : undefined;
        const key = chameleonNs
            ? `${item.location}|${chameleonNs}`
            : item.location;

        const existing = documents.get(key);
        if (existing) continue;

        const raw = buildSchemaDocument(
            root,
            item.location,
            diagnostics,
            chameleonNs,
        );
        if (!raw) continue;

        const doc: SchemaDocument = {
            key,
            location: item.location,
            targetNamespace: raw.targetNamespace,
            chameleon: chameleonNs !== undefined,
            raw,
            links: [],
        };
        documents.set(key, doc);
        ordered.push(doc);

        // -- namespace consistency of the link that brought us here -------------
        if (item.kind && item.kind !== 'import' && item.owner) {
            if (
                item.includerNs !== undefined &&
                declaresNs &&
                raw.targetNamespace !== item.includerNs
            )
                diagnostics.error(
                    'include-namespace-mismatch',
                    `<${item.kind}> of "${item.location}": its targetNamespace "${raw.targetNamespace}" differs from the including schema's "${item.includerNs}"`,
                    item.link?.raw.path,
                    item.owner.location,
                );
        }
        if (item.kind === 'import' && item.importNs !== undefined) {
            if (raw.targetNamespace !== item.importNs)
                diagnostics.error(
                    'import-namespace-mismatch',
                    `<import namespace="${item.importNs}"> loaded "${item.location}", whose targetNamespace is "${raw.targetNamespace}"`,
                    item.link?.raw.path,
                    item.owner?.location,
                );
        }

        // -- discover links ---------------------------------------------------
        const addLink = (
            kind: SchemaLinkKind,
            rawLink: SchemaLink['raw'],
            schemaLocation: string | undefined,
            importNs?: string,
        ) => {
            const link: SchemaLink = { kind, raw: rawLink };
            doc.links.push(link);
            if (!schemaLocation) return;
            link.location = resolveLocation(schemaLocation, doc.location);
            pending.push({ doc, link });
            queue.push({
                location: link.location,
                from: doc.location,
                includerNs: kind === 'import' ? undefined : doc.targetNamespace,
                importNs,
                kind,
                link,
                owner: doc,
            });
        };
        for (const l of raw.includes) addLink('include', l, l.schemaLocation);
        for (const l of raw.redefines) addLink('redefine', l, l.schemaLocation);
        for (const l of raw.overrides) addLink('override', l, l.schemaLocation);
        for (const l of raw.imports) {
            // the XML and XSD namespaces are built in: never go looking for xml.xsd
            const builtin = l.namespace === XML_NS || l.namespace === XSD_NS;
            addLink(
                'import',
                l,
                builtin ? undefined : l.schemaLocation,
                l.namespace,
            );
        }
    }

    // -- bind link targets ------------------------------------------------------
    for (const { doc, link } of pending) {
        const loc = link.location!;
        const candidates =
            link.kind === 'import'
                ? [documents.get(loc)]
                : [
                      documents.get(`${loc}|${doc.targetNamespace}`),
                      documents.get(loc),
                  ];
        link.target = candidates.find(
            c =>
                c !== undefined &&
                (link.kind === 'import' ||
                    c.targetNamespace === doc.targetNamespace),
        );
    }

    const entryDoc = documents.get(entryLocation);
    if (!entryDoc) {
        diagnostics.throwIfErrors();
        throw new Error(`Could not load schema "${entryLocation}"`);
    }
    return { entry: entryDoc, documents: ordered, diagnostics };
}

/** Load a schema and everything it includes/imports/redefines, synchronously. */
export const loadSchemaSetSync = (
    entry: SchemaEntry,
    options: LoadOptions = {},
): SchemaSet => {
    const diagnostics = options.diagnostics ?? new DiagnosticBag();
    const gen = walk(entry, options, diagnostics);
    let step = gen.next();
    while (!step.done) step = gen.next(readSync(step.value.plan));
    return step.value;
};

/** Like `loadSchemaSetSync`, but remote (`http(s)`) schemas are fetched. */
export const loadSchemaSet = async (
    entry: SchemaEntry,
    options: LoadOptions = {},
): Promise<SchemaSet> => {
    const diagnostics = options.diagnostics ?? new DiagnosticBag();
    const gen = walk(entry, options, diagnostics);
    let step = gen.next();
    while (!step.done)
        step = gen.next(await readAsync(step.value.plan, options));
    return step.value;
};
