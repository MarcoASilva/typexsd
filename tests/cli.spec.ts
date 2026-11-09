import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli';
import { typecheck } from './helpers';

const assets = join(__dirname, 'assets');

const cli = async (...argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await run(argv, {
        log: m => out.push(m),
        error: m => err.push(m),
    });
    return { code, out: out.join('\n'), err: err.join('\n') };
};

describe('cli', () => {
    it('generates types from an XSD', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'typexsd-cli-'));
        const out = join(dir, 'types.ts');
        const result = await cli(
            'generate',
            join(assets, 'openimmo_127b.xsd'),
            '--out',
            out,
        );
        expect(result.code).toBe(0);
        expect(result.err).toContain('complextype-simplecontent-mixed');
        expect(result.err).toContain(`Wrote ${out}`);
        const source = readFileSync(out, 'utf8');
        expect(source).toContain('export interface Schema {');
        expect(typecheck(source)).toEqual([]);
    });

    it('supports --map, --type, --root, --no-docs, --quiet and --local-fallback', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'typexsd-cli-'));
        const main = join(dir, 'main.xsd');
        const out = join(dir, 'types.ts');
        writeFileSync(
            main,
            `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:include schemaLocation="http://x.test/base.xsd"/>
               <xs:element name="a"><xs:annotation><xs:documentation>docs</xs:documentation></xs:annotation><xs:complexType><xs:sequence><xs:element name="when" type="xs:dateTime"/></xs:sequence></xs:complexType></xs:element></xs:schema>`,
        );
        writeFileSync(
            join(dir, 'local.xsd'),
            `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="b" type="xs:string"/></xs:schema>`,
        );

        const result = await cli(
            'generate',
            main,
            '--out',
            out,
            '--map',
            `http://x.test/base.xsd=${join(dir, 'local.xsd')}`,
            '--type',
            'dateTime=Date',
            '--root',
            'Root',
            '--no-docs',
            '--quiet',
        );
        expect(result).toEqual({ code: 0, out: '', err: '' });
        const source = readFileSync(out, 'utf8');
        expect(source).toContain('export interface Root {');
        expect(source).toContain('when: Date;');
        expect(source).toContain('b?: string;');
        expect(source).not.toContain('docs');

        writeFileSync(
            join(dir, 'base.xsd'),
            readFileSync(join(dir, 'local.xsd')),
        );
        const fallback = await cli(
            'generate',
            main,
            '--out',
            out,
            '--local-fallback',
            '--quiet',
        );
        expect(fallback.code).toBe(0);
        expect(readFileSync(out, 'utf8')).toContain('b?: string;');
    });

    it('fails on schema errors with --strict', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'typexsd-cli-'));
        const bad = join(dir, 'bad.xsd');
        writeFileSync(
            bad,
            `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="a" type="nope"/></xs:schema>`,
        );
        await expect(
            cli('generate', bad, '--out', join(dir, 'o.ts'), '--strict'),
        ).rejects.toThrow(/unresolved-reference/);
        const lenient = await cli('generate', bad, '--out', join(dir, 'o.ts'));
        expect(lenient.code).toBe(0);
        expect(lenient.err).toContain('unresolved-reference');
    });

    it('prints usage for help, missing and unknown arguments', async () => {
        expect((await cli('--help')).out).toContain('Usage:');
        expect((await cli()).code).toBe(2);
        expect((await cli('generate')).code).toBe(2);
        const unknown = await cli('generate', 'x.xsd', '--bogus');
        expect(unknown.code).toBe(2);
        expect(unknown.err).toContain('Unknown option --bogus');
        expect((await cli('generate', 'x.xsd', '--out')).err).toContain(
            'needs a value',
        );
        expect(
            (await cli('generate', 'x.xsd', '--map', 'novalue')).err,
        ).toContain('expects <key>=<value>');
    });
});
