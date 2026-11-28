# Contributing

## Running the checks

```sh
npm ci
npm test            # unit tests (tests/)
npm run test:e2e    # end-to-end contract (e2e/), needs a JDK
npm run typecheck
npm run check       # biome lint + format
```

The e2e suite validates XML with
[`xsd-schema-validator`](https://www.npmjs.com/package/xsd-schema-validator),
which compiles and runs a small Java helper, so it needs a JDK (`javac` and
`java`) on the `PATH` or at `JAVA_HOME`.

Before committing, review your diff and update any doc it makes outdated, in the
same commit: `README.md` (and its "upgrading" section for breaking changes),
`known_issues.md`, this file, and `AGENTS.md`.

## The e2e suite is the behaviour contract

`e2e/` tests the library as a black box through its public API, against golden
fixtures:

| fixture         | what it is                                               |
| --------------- | -------------------------------------------------------- |
| `schema.xsd`    | the input XSD                                            |
| `interfaces.ts` | exactly what `generateTypes(schema.xsd)` emits           |
| `document.ts`   | an object typed by `interfaces.ts`                       |
| `document.xml`  | exactly what building `document.ts` emits, valid per XSD |

These files define what typexsd does for its users. If your change makes an e2e
check fail, the library's observable behaviour has changed, and that may break
users who upgrade. Fix the library, not the test.

### Changing the contract on purpose

Sometimes a behaviour change is the point of the PR. Then, and only then, update
the e2e suite, and fill in the `## Why the e2e contract changes` section of the
pull request template:

- **What changes:** the observable behaviour that differs, with a before/after
  example if possible.
- **Why:** why the library needs this change, and why the old behaviour is wrong
  or insufficient. Be very clear; this is what reviewers and future readers rely
  on.
- **Compatibility:** tick exactly one box, "breaking change" (semver major) or
  "backward compatible".
- For a breaking change, add a migration note to the "upgrading" section of the
  README.

The guarded paths are `e2e/**` and `vitest.e2e.config.mts`. The
`contract-guard` CI check fails any PR that touches them without that section,
and they need a review from a code owner.

### Regenerating fixtures

Keep the four fixtures consistent with each other; the suite checks that they
are. After an intended codegen change, regenerate the interfaces with the CLI:

```sh
npm run build
node build/cli.js generate e2e/fixtures/openimmo-1.2.7b/schema.xsd \
    --out e2e/fixtures/openimmo-1.2.7b/interfaces.ts
```

Then update `document.ts` and `document.xml` so that building the object still
produces the XML byte for byte, and parsing the XML still produces the object.
