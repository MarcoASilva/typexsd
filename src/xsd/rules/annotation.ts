import { XmlElement } from '../dom';
import { XML_NS } from '../names';
import { Annotation, Documentation } from './raw';
import { defineRule, star, token, uri } from './engine';

const deepText = (node: XmlElement): string =>
    node.content.map(c => (typeof c === 'string' ? c : deepText(c))).join('');

/** `<xs:annotation>`: documentation and appinfo, both free-form. */
defineRule<Annotation>({
    name: 'annotation',
    attributes: { id: token() },
    children: [star('appinfo', 'documentation')],
    build: ({ kids }) => ({
        documentation: kids.all
            .filter(k => k.name === 'documentation')
            .map(k => k.value as Documentation),
        appinfo: kids.all
            .filter(k => k.name === 'appinfo')
            .map(k => k.value as string),
    }),
});

defineRule<Documentation>({
    name: 'documentation',
    attributes: { source: uri() },
    children: [],
    opaque: true,
    build: ({ node }) => ({
        lang: node.attrNS(XML_NS, 'lang'),
        text: deepText(node).replace(/\s+/g, ' ').trim(),
    }),
});

defineRule<string>({
    name: 'appinfo',
    attributes: { source: uri() },
    children: [],
    opaque: true,
    build: ({ node }) => deepText(node).replace(/\s+/g, ' ').trim(),
});
