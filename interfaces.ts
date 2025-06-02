export interface Schema {
    bookElement?: BookElement | BookElement1 | BookElement2;
    chapterElement?: ChapterElement | ChapterElement1;
    'crossway-bible'?: CrosswayBible;
    verseElement?: VerseElement | VerseElement1 | VerseElement2 | VerseElement3 | VerseElement4;
    aElement?: AElement;
    beginLineElement?: BeginLineElement;
    beginParagraphElement?: BeginParagraphElement;
    blockElements?: BlockElements | BlockElements1 | BlockElements2 | BlockElements3 | BlockElements4 | BlockElements5 | BlockElements6;
    crossrefsElement?: CrossrefsElement;
    crossrefElement?: CrossrefElement;
    emptyElement?: EmptyElement;
    endLineElement?: EndLineElement;
    footnoteElement?: FootnoteElement | FootnoteElement1 | FootnoteElement2 | FootnoteElement3;
    headingElement?: HeadingElement;
    iElement?: IElement;
    markerElement?: MarkerElement;
    qElement?: QElement;
    quoteIdAttribute?: string;
    selahElement?: SelahElement | SelahElement1 | SelahElement2;
    spanElement?: SpanElement;
    standardTextElements?: StandardTextElements | StandardTextElements1 | StandardTextElements2 | StandardTextElements3 | StandardTextElements4 | StandardTextElements5;
    subheadingElement?: SubheadingElement | SubheadingElement1 | SubheadingElement2 | SubheadingElement3;
    verseNumElement?: VerseNumElement;
    wocElement?: WocElement;
}
export interface BookElement {
    chapter: ChapterElement | ChapterElement1;
    title: string;
    num: number;
}
export interface BookElement1 {
    heading?: HeadingElement;
    title: string;
    num: number;
}
export interface BookElement2 {
    marker?: MarkerElement;
    title: string;
    num: number;
}
export interface ChapterElement {
    blockElements?: BlockElements | BlockElements1 | BlockElements2 | BlockElements3 | BlockElements4 | BlockElements5 | BlockElements6;
    num: number;
}
export interface ChapterElement1 {
    verse: VerseElement | VerseElement1 | VerseElement2 | VerseElement3 | VerseElement4;
    num: number;
}
export interface CrosswayBible {
    book: BookElement | BookElement1 | BookElement2;
    translation: string;
    revision: string;
}
export interface VerseElement {
    standardTextElements?: StandardTextElements | StandardTextElements1 | StandardTextElements2 | StandardTextElements3 | StandardTextElements4 | StandardTextElements5;
    num: number;
    class?: "woc";
}
export interface VerseElement1 {
    blockElements?: BlockElements | BlockElements1 | BlockElements2 | BlockElements3 | BlockElements4 | BlockElements5 | BlockElements6;
    num: number;
    class?: "woc";
}
export interface VerseElement2 {
    woc?: WocElement;
    num: number;
    class?: "woc";
}
export interface VerseElement3 {
    selah?: SelahElement | SelahElement1 | SelahElement2;
    num: number;
    class?: "woc";
}
export interface VerseElement4 {
    marker?: MarkerElement;
    num: number;
    class?: "woc";
}
export interface AElement {
    href: string;
}
export interface BeginLineElement {
    class?: "indent" | "indent-2" | "declares" | "psalm-doxology" | "virtual";
}
export interface BeginParagraphElement {
    class?: "same-paragraph" | "extra-space" | "line-group" | "virtual" | "line-group-virtual";
}
export interface BlockElements {
    'begin-block-indent'?: EmptyElement;
}
export interface BlockElements1 {
    'begin-paragraph'?: BeginParagraphElement;
}
export interface BlockElements2 {
    'end-paragraph'?: EmptyElement;
}
export interface BlockElements3 {
    'end-block-indent'?: EmptyElement;
}
export interface BlockElements4 {
    heading?: HeadingElement;
}
export interface BlockElements5 {
    marker?: MarkerElement;
}
export interface BlockElements6 {
    subheading?: SubheadingElement | SubheadingElement1 | SubheadingElement2 | SubheadingElement3;
}
export interface CrossrefsElement {
    crossref: CrossrefElement;
}
export interface CrossrefElement {
    let?: string;
    cid: string;
    class?: string;
}
export interface EmptyElement {
    class?: string;
}
export interface EndLineElement {
    class?: "br" | "virtual";
}
export interface FootnoteElement {
    span?: SpanElement;
    class?: string;
}
export interface FootnoteElement1 {
    'verse-num'?: number;
    class?: string;
}
export interface FootnoteElement2 {
    i?: IElement;
    class?: string;
}
export interface FootnoteElement3 {
    a?: AElement;
    class?: string;
}
export interface HeadingElement {
    span?: SpanElement;
    class?: "psalm-book";
}
export interface IElement {
    span?: SpanElement;
}
export interface MarkerElement {
    class?: string;
    cid: string;
}
export interface QElement {
    class: "begin-double" | "continue-double" | "end-double" | "begin-single" | "continue-single" | "end-single" | "begin-inner-double" | "continue-inner-double" | "end-inner-double" | "begin-inner-single" | "continue-inner-single" | "end-inner-single";
    qid: string;
    from: string;
    to: string;
}
export interface SelahElement {
    footnote?: FootnoteElement | FootnoteElement1 | FootnoteElement2 | FootnoteElement3;
}
export interface SelahElement1 {
    crossrefs?: CrossrefsElement;
}
export interface SelahElement2 {
    crossref?: CrossrefElement;
}
export interface SpanElement {
    class?: "divine-name" | "us-time" | "small-caps";
}
export interface StandardTextElements {
    span?: SpanElement;
}
export interface StandardTextElements1 {
    footnote?: FootnoteElement | FootnoteElement1 | FootnoteElement2 | FootnoteElement3;
}
export interface StandardTextElements2 {
    crossrefs?: CrossrefsElement;
}
export interface StandardTextElements3 {
    crossref?: CrossrefElement;
}
export interface StandardTextElements4 {
    'begin-line'?: BeginLineElement;
}
export interface StandardTextElements5 {
    'end-line'?: EndLineElement;
}
export interface SubheadingElement {
    span?: SpanElement;
    class?: "psalm-acrostic-title" | "psalm-title" | "speaker" | "textual-note";
}
export interface SubheadingElement1 {
    footnote?: FootnoteElement | FootnoteElement1 | FootnoteElement2 | FootnoteElement3;
    class?: "psalm-acrostic-title" | "psalm-title" | "speaker" | "textual-note";
}
export interface SubheadingElement2 {
    crossrefs?: CrossrefsElement;
    class?: "psalm-acrostic-title" | "psalm-title" | "speaker" | "textual-note";
}
export interface SubheadingElement3 {
    crossref?: CrossrefElement;
    class?: "psalm-acrostic-title" | "psalm-title" | "speaker" | "textual-note";
}
export interface VerseNumElement {
    class?: "woc";
    'begin-chapter'?: number;
}
export interface WocElement {
    standardTextElements?: StandardTextElements | StandardTextElements1 | StandardTextElements2 | StandardTextElements3 | StandardTextElements4 | StandardTextElements5;
}
