import { Annotation } from '../xsd/rules/raw';
import { SimpleTypeDef } from '../xsd/model';
import { TsDoc } from './ir';

/**
 * Pick the documentation text of an annotation: entries in the preferred
 * language (or without a language) win; otherwise the first language found.
 */
export const docParagraphs = (
    annotation: Annotation | undefined,
    lang: string,
): string[] => {
    if (!annotation) return [];
    const docs = annotation.documentation.filter(d => d.text);
    if (!docs.length) return [];
    const preferred = docs.filter(
        d => !d.lang || d.lang.toLowerCase().startsWith(lang.toLowerCase()),
    );
    const chosen = preferred.length
        ? preferred
        : docs.filter(d => d.lang === docs[0].lang);
    return chosen.map(d => d.text);
};

/** Facets set by this derivation step (not inherited), as TSDoc tags. */
export const facetTags = (type: SimpleTypeDef): string[] => {
    const base = type.base?.facets;
    const f = type.facets;
    const tags: string[] = [];
    const changed = <K extends keyof typeof f>(key: K) =>
        f[key] !== undefined && f[key] !== base?.[key];

    if (changed('length')) tags.push(`@length ${f.length}`);
    if (changed('minLength')) tags.push(`@minLength ${f.minLength}`);
    if (changed('maxLength')) tags.push(`@maxLength ${f.maxLength}`);
    if (changed('minInclusive')) tags.push(`@minimum ${f.minInclusive}`);
    if (changed('minExclusive'))
        tags.push(`@exclusiveMinimum ${f.minExclusive}`);
    if (changed('maxInclusive')) tags.push(`@maximum ${f.maxInclusive}`);
    if (changed('maxExclusive'))
        tags.push(`@exclusiveMaximum ${f.maxExclusive}`);
    if (changed('totalDigits')) tags.push(`@totalDigits ${f.totalDigits}`);
    if (changed('fractionDigits'))
        tags.push(`@fractionDigits ${f.fractionDigits}`);
    for (const step of f.patterns.slice(base?.patterns.length ?? 0))
        tags.push(`@pattern ${step.join(' | ')}`);
    return tags;
};

export const makeDoc = (
    annotation: Annotation | undefined,
    lang: string,
    enabled: boolean,
    extraTags: string[] = [],
): TsDoc | undefined => {
    if (!enabled) return undefined;
    const text = docParagraphs(annotation, lang);
    if (!text.length && !extraTags.length) return undefined;
    return { text, tags: extraTags };
};
