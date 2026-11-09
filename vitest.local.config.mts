import { defineConfig } from 'vitest/config';

/** Unofficial local-only suites under `.local/` */
export default defineConfig({
    test: {
        include: ['.local/**/*.spec.ts'],
        environment: 'node',
        testTimeout: 30_000,
    },
});
