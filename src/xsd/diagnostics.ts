export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
    severity: Severity;
    /** Stable machine readable code, e.g. `element-ref-and-name`. */
    code: string;
    message: string;
    /** Location of the offending XSD node, e.g. `/schema/complexType[@name='x']/sequence`. */
    path?: string;
    /** Schema document the node came from. */
    file?: string;
}

export class XsdError extends Error {
    constructor(public readonly diagnostics: Diagnostic[]) {
        super(
            `XSD processing failed with ${diagnostics.length} error(s):\n` +
                diagnostics.map(formatDiagnostic).join('\n'),
        );
        this.name = 'XsdError';
    }
}

export const formatDiagnostic = (d: Diagnostic): string => {
    const where = [d.file, d.path].filter(Boolean).join(' ');
    return `[${d.severity}] ${d.code}: ${d.message}${
        where ? ` (${where})` : ''
    }`;
};

/**
 * Collects diagnostics. Processing is lenient by default (real-world schemas
 * are messy); callers can turn errors into exceptions with `throwIfErrors`.
 */
export class DiagnosticBag {
    readonly items: Diagnostic[] = [];

    add(d: Diagnostic): void {
        this.items.push(d);
    }

    error(code: string, message: string, path?: string, file?: string): void {
        this.add({ severity: 'error', code, message, path, file });
    }

    warn(code: string, message: string, path?: string, file?: string): void {
        this.add({ severity: 'warning', code, message, path, file });
    }

    info(code: string, message: string, path?: string, file?: string): void {
        this.add({ severity: 'info', code, message, path, file });
    }

    get errors(): Diagnostic[] {
        return this.items.filter(d => d.severity === 'error');
    }

    get warnings(): Diagnostic[] {
        return this.items.filter(d => d.severity === 'warning');
    }

    throwIfErrors(): void {
        const errors = this.errors;
        if (errors.length) throw new XsdError(errors);
    }
}
