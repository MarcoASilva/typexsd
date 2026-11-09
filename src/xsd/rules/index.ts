import { XmlElement } from '../dom';
import { DiagnosticBag } from '../diagnostics';
import { XSD_NS } from '../names';
import { BuildContext, buildNode } from './engine';
import { RawSchema } from './raw';

// importing the rule modules registers every XSD element rule
import './annotation';
import './schema';
import './declarations';
import './types';

export * from './raw';
export { ruleNames, getRule } from './engine';

/**
 * Interpret the root `<xs:schema>` of a parsed document into raw components.
 * `chameleonNs` makes a no-namespace document adopt the namespace of the
 * schema that includes it.
 */
export const buildSchemaDocument = (
    root: XmlElement,
    file: string,
    diagnostics: DiagnosticBag,
    chameleonNs?: string,
): RawSchema | undefined => {
    if (root.ns !== XSD_NS || root.local !== 'schema') {
        diagnostics.error(
            'not-a-schema',
            `root element is <${root.local}> (namespace "${root.ns}"), expected an XML Schema <schema>`,
            root.path,
            file,
        );
        return undefined;
    }
    const ctx = new BuildContext(file, diagnostics, chameleonNs);
    return buildNode(root, '#document', ctx) as RawSchema;
};
