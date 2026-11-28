# AGENTS.md

typexsd: type-safe XML builder and parser driven by an XSD. Library code lives
in `src/`, unit tests in `tests/`, the end-to-end contract in `e2e/`, usage
examples in `examples/`.

## Commands

- `npm test` - unit tests (`tests/**/*.spec.ts`)
- `npm run test:e2e` - end-to-end contract (`e2e/**/*.spec.ts`); needs a JDK for XSD validation
- `npm run typecheck` - typecheck `src/`, `tests/`, `e2e/` and `examples/`
- `npm run check` - biome lint and format

Run `npm test`, `npm run test:e2e` and `npm run typecheck` before finishing a change.

## The e2e suite is the behaviour contract

`e2e/` guards the observable behaviour of the public API: XSD in, types out,
object in, XML out, XML in, object out. A change to it means the library's
behaviour changes, which can be a breaking change for users. Treat it as
read-only.

- Never edit, delete, rename, move or regenerate anything in `e2e/` or
  `vitest.e2e.config.mts` unless the user explicitly asks you to change the
  contract. Being asked to "make the tests pass" is not such a request.
- When an e2e check fails, treat it as a regression in `src/`: fix the library,
  or stop and report the failure. Do not update fixtures, loosen assertions or
  skip tests to make it pass.
- If the user does ask for a contract change, the PR description must contain a
  filled-in `## Why the e2e contract changes` section (see
  `.github/pull_request_template.md`); draft it for them. It must say which
  observable behaviour changes, explain clearly **why**, and tick exactly one of
  "breaking change" or "backward compatible". For a breaking change, also add a
  migration note to the "upgrading" section of `README.md`.

CI rejects PRs that touch `e2e/` or `vitest.e2e.config.mts` without that
section. See `CONTRIBUTING.md` for the full rules.

## Before committing

Review your own diff (`git diff` and `git status`) as a reviewer would, then
check whether the change makes any reference file wrong or incomplete, and
update it in the same commit:

- `README.md` - user-facing behaviour: public API, options, CLI flags, the
  shape of generated types, supported XSD constructs. A breaking change also
  needs a note in the "upgrading" section.
- `known_issues.md` - a limitation you fixed, found or changed.
- `CONTRIBUTING.md` - the development workflow: scripts, test layout, fixtures,
  CI checks, required tooling.
- `AGENTS.md` (this file) - project layout, commands, and rules an agent needs;
  also anything you had to discover the hard way that the next agent should
  know. `CLAUDE.md` only imports this file; never duplicate content there.

Docs should describe the code as it is after the commit. Do not add notes about
the change itself (that belongs in the commit message or PR description).
