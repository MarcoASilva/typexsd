import { join } from "node:path";
import ts from "typescript";
import { expect } from "vitest";
import { validateXML } from "xsd-schema-validator";

/**
 * Validate against the XSD with an independent validator (Java/Xerces), so the
 * library is never the judge of its own output. On failure the rejection
 * message lists every schema violation.
 */
export const expectValidAgainstXsd = async (
	xml: string,
	xsdPath: string,
): Promise<void> => {
	await expect(validateXML(xml, xsdPath)).resolves.toMatchObject({
		valid: true,
	});
};

/** Typecheck a file (and its imports) in strict mode; returns the diagnostics. */
export const typecheckFile = (fileName: string): string[] => {
	const program = ts.createProgram([fileName], {
		strict: true,
		noEmit: true,
		skipLibCheck: true,
		target: ts.ScriptTarget.ES2021,
		module: ts.ModuleKind.CommonJS,
		types: ["node"],
		typeRoots: [join(__dirname, "..", "node_modules", "@types")],
	});
	return ts.getPreEmitDiagnostics(program).map(d => {
		const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
		if (!d.file || d.start === undefined) return message;
		const { line, character } = d.file.getLineAndCharacterOfPosition(
			d.start,
		);
		return `${d.file.fileName}:${line + 1}:${character + 1} ${message}`;
	});
};
