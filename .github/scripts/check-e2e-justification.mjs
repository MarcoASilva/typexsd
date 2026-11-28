#!/usr/bin/env node
// Fails when a PR touches the e2e contract without explaining why.
//
// Usage: PR_BODY="..." node check-e2e-justification.mjs <changed-files.txt>
// where <changed-files.txt> holds one repository-relative path per line.

import { readFileSync } from "node:fs";

const HEADING = "Why the e2e contract changes";

const isGuarded = file =>
	file.startsWith("e2e/") || file === "vitest.e2e.config.mts";

const out = text => process.stdout.write(`${text}\n`);

const fail = (problems, guarded) => {
	for (const problem of problems)
		out(`::error title=e2e contract::${problem}`);
	out("");
	out("This PR changes the e2e behaviour contract:");
	for (const file of guarded) out(`  - ${file}`);
	out("");
	out(`Add a "## ${HEADING}" section to the PR description that says which`);
	out(
		"observable behaviour changes and explains clearly why, and tick exactly",
	);
	out(
		'one of "Breaking change" or "Backward compatible". See CONTRIBUTING.md.',
	);
	process.exit(1);
};

/** The section's body: from its heading to the next `#` or `##` heading. */
const extractSection = body => {
	const lines = body.replace(/\r\n?/g, "\n").split("\n");
	const start = lines.findIndex(line => line.trim() === `## ${HEADING}`);
	if (start === -1) return undefined;
	const rest = lines.slice(start + 1);
	const end = rest.findIndex(line => /^#{1,2}\s/.test(line.trim()));
	return (end === -1 ? rest : rest.slice(0, end)).join("\n");
};

const checkboxPattern = /^\s*[-*]\s+\[([ xX])\]\s*(.*)$/;

const check = (changedFiles, body) => {
	const guarded = changedFiles.filter(isGuarded);
	if (guarded.length === 0) return { guarded, problems: [] };

	const section = extractSection(body ?? "");
	if (section === undefined)
		return {
			guarded,
			problems: [`The PR description has no "## ${HEADING}" section.`],
		};

	const lines = section.replace(/<!--[\s\S]*?-->/g, "").split("\n");
	const boxes = lines
		.map(line => line.match(checkboxPattern))
		.filter(Boolean)
		.map(([, mark, label]) => ({ checked: mark !== " ", label }));
	const explanation = lines
		.filter(line => !checkboxPattern.test(line))
		.join("\n")
		.trim();

	const ticked = boxes.filter(
		box =>
			box.checked &&
			/breaking change|backward compatible/i.test(box.label),
	);

	const problems = [];
	if (!explanation)
		problems.push(
			`The "${HEADING}" section has no explanation of what changes and why.`,
		);
	if (ticked.length !== 1)
		problems.push(
			`Tick exactly one of "Breaking change" or "Backward compatible" (ticked: ${ticked.length}).`,
		);
	return { guarded, problems };
};

const [listPath] = process.argv.slice(2);
if (!listPath) {
	out("usage: check-e2e-justification.mjs <changed-files.txt>");
	process.exit(2);
}
const changedFiles = readFileSync(listPath, "utf8")
	.split("\n")
	.map(line => line.trim())
	.filter(Boolean);

const { guarded, problems } = check(changedFiles, process.env.PR_BODY);
if (guarded.length === 0) {
	out("No e2e contract files changed.");
} else {
	if (problems.length > 0) fail(problems, guarded);
	out(
		`e2e contract change is explained (${guarded.length} file(s) changed).`,
	);
}
