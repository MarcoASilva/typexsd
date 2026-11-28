import { defineConfig } from "vitest/config";

/** End-to-end contract suites under `e2e/` (XSD validation needs a Java runtime) */
export default defineConfig({
	test: {
		include: ["e2e/**/*.spec.ts"],
		environment: "node",
		testTimeout: 60_000,
	},
});
