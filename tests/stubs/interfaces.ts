export interface Schema {
    openimmo?: Openimmo;
    uebertragung?: Uebertragung;
    anbieter?: Anbieter;
    immobilie?: Immobilie;
    objektkategorie?: Objektkategorie;
    geo?: Geo | Geo1 | Geo2;
    kontaktperson?: Kontaktperson | Kontaktperson1 | Kontaktperson2 | Kontaktperson3 | Kontaktperson4 | Kontaktperson5;
    weitere_adresse?: WeitereAdresse;
    preise?: Preise;
    bieterverfahren?: Bieterverfahren;
    versteigerung?: Versteigerung;
    flaechen?: Flaechen;
    ausstattung?: Ausstattung;
    zustand_angaben?: ZustandAngaben;
    bewertung?: Bewertung;
    infrastruktur?: Infrastruktur;
    freitexte?: Freitexte;
    anhaenge?: Anhaenge;
    verwaltung_objekt?: VerwaltungObjekt;
    verwaltung_techn?: VerwaltungTechn;
    openimmo_anid?: string;
    lizenzkennung?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    bundesland?: string;
    geokoordinaten?: Geokoordinaten;
    gemeindecode?: string;
    flur?: string;
    flurstueck?: string;
    gemarkung?: string;
    etage?: number;
    anzahl_etagen?: number;
    lage_im_bau?: LageImBau;
    wohnungsnr?: string;
    lage_gebiet?: LageGebiet;
    regionaler_zusatz?: string;
    karten_makro?: boolean;
    karten_mikro?: boolean;
    virtuelletour?: boolean;
    luftbildern?: boolean;
    referenz_id?: string;
    vorname?: string;
    name?: string;
    titel?: string;
    anrede?: string;
    position?: string;
    anrede_brief?: string;
    firma?: string;
    zusatzfeld?: string;
    postfach?: string;
    postf_plz?: string;
    postf_ort?: string;
    email_direkt?: string;
    email_zentrale?: string;
    email_privat?: string;
    email_sonstige?: EmailSonstige;
    email_feedback?: string;
    tel_zentrale?: string;
    tel_durchw?: string;
    tel_privat?: string;
    tel_handy?: string;
    tel_fax?: string;
    tel_sonstige?: TelSonstige;
    url?: string;
    adressfreigabe?: boolean;
    personennummer?: string;
    immobilientreuhaenderid?: string;
    freitextfeld?: string;
    objektart?: Objektart | Objektart1 | Objektart2 | Objektart3 | Objektart4 | Objektart5 | Objektart6 | Objektart7 | Objektart8 | Objektart9 | Objektart10 | Objektart11 | Objektart12;
    vermarktungsart?: Vermarktungsart;
    nutzungsart?: Nutzungsart;
    hauptmietzinsnetto?: Hauptmietzinsnetto;
    pauschalmiete?: number;
    betriebskostennetto?: Betriebskostennetto;
    evbnetto?: Evbnetto;
    flaechevon?: number;
    flaechebis?: number;
    gesamtmietenetto?: Gesamtmietenetto;
    gesamtmietebrutto?: number;
    gesamtbelastungnetto?: Gesamtbelastungnetto;
    gesamtbelastungbrutto?: number;
    gesamtkostenprom2von?: Gesamtkostenprom2von;
    heizkostennetto?: Heizkostennetto;
    kaufpreisnetto?: Kaufpreisnetto;
    kaufpreisbrutto?: number;
    monatlichekostennetto?: Monatlichekostennetto;
    monatlichekostenbrutto?: number;
    nebenkostenprom2von?: Nebenkostenprom2von;
    nettomieteprom2von?: Nettomieteprom2von;
    provisionnetto?: Provisionnetto;
    provisionbrutto?: number;
    ruecklagenetto?: Ruecklagenetto;
    sonstigekostennetto?: Sonstigekostennetto;
    sonstigemietenetto?: Sonstigemietenetto;
    summemietenetto?: Summemietenetto;
    richtpreisprom2?: number;
    kaufpreis?: Kaufpreis;
    nettokaltmiete?: number;
    kaltmiete?: number;
    nebenkosten?: number;
    warmmiete?: number;
    heizkosten_enthalten?: boolean;
    heizkosten?: number;
    zzg_mehrwertsteuer?: boolean;
    mietzuschlaege?: number;
    pacht?: number;
    erbpacht?: number;
    hausgeld?: number;
    abstand?: number;
    preis_zeitraum_von?: string;
    preis_zeitraum_bis?: string;
    preis_zeiteinheit?: PreisZeiteinheit;
    mietpreis_pro_qm?: number;
    kaufpreis_pro_qm?: number;
    richtpreis?: number;
    stp_freiplatz?: Stellplatz;
    stp_tiefgarage?: Stellplatz;
    stp_garage?: Stellplatz;
    stp_carport?: Stellplatz;
    stp_duplex?: Stellplatz;
    stp_parkhaus?: Stellplatz;
    stp_sonstige?: StpSonstige;
    provisionspflichtig?: boolean;
    provision_teilen?: ProvisionTeilen;
    aussen_courtage?: AussenCourtage;
    innen_courtage?: InnenCourtage;
    courtage_hinweis?: string;
    mwst_satz?: number;
    mwst_gesamt?: number;
    freitext_preis?: string;
    x_fache?: string;
    nettorendite?: number;
    nettorendite_ist?: number;
    nettorendite_soll?: number;
    mieteinnahmen_ist?: MieteinnahmenIst;
    mieteinnahmen_soll?: MieteinnahmenSoll;
    erschliessungskosten?: number;
    kaution?: number;
    kaution_text?: string;
    geschaeftsguthaben?: number;
    wohnflaeche?: number;
    nutzflaeche?: number;
    gesamtflaeche?: number;
    ladenflaeche?: number;
    lagerflaeche?: number;
    verkaufsflaeche?: number;
    freiflaeche?: number;
    bueroflaeche?: number;
    bueroteilflaeche?: number;
    fensterfront?: number;
    sonstflaeche?: number;
    verwaltungsflaeche?: number;
    gastroflaeche?: number;
    grz?: string;
    gfz?: string;
    bmz?: string;
    bgf?: string;
    grundstuecksflaeche?: number;
    anzahl_zimmer?: number;
    anzahl_schlafzimmer?: number;
    anzahl_badezimmer?: number;
    anzahl_sep_wc?: number;
    balkon_terrasse_flaeche?: number;
    anzahl_wohn_schlafzimmer?: number;
    gartenflaeche?: number;
    anzahl_balkon_terrassen?: number;
    anzahl_balkone?: number;
    anzahl_terrassen?: number;
    anzahl_logia?: number;
    kellerflaeche?: number;
    fensterfront_qm?: number;
    grundstuecksfront?: number;
    dachbodenflaeche?: number;
    teilbar_ab?: number;
    beheizbare_flaeche?: number;
    anzahl_stellplaetze?: number;
    plaetze_gastraum?: number;
    anzahl_betten?: number;
    anzahl_tagungsraeume?: number;
    vermietbare_flaeche?: number;
    anzahl_wohneinheiten?: number;
    anzahl_gewerbeeinheiten?: number;
    einliegerwohnung?: boolean;
    kubatur?: number;
    ausnuetzungsziffer?: number;
    beginn_angebotsphase?: string;
    besichtigungstermin?: string;
    besichtigungstermin_2?: string;
    beginn_bietzeit?: string;
    ende_bietzeit?: string;
    hoechstgebot_zeigen?: boolean;
    mindestpreis?: number;
    zwangsversteigerung?: boolean;
    aktenzeichen?: string;
    zvtermin?: string;
    zusatztermin?: string;
    amtsgericht?: string;
    verkehrswert?: number;
    wg_geeignet?: boolean;
    ausstatt_kategorie?: "STANDARD" | "GEHOBEN" | "LUXUS";
    raeume_veraenderbar?: boolean;
    bad?: Bad;
    kueche?: Kueche;
    boden?: Boden;
    kamin?: boolean;
    heizungsart?: Heizungsart;
    befeuerung?: Befeuerung;
    klimatisiert?: boolean;
    fahrstuhl?: Fahrstuhl;
    stellplatzart?: Stellplatzart;
    gartennutzung?: boolean;
    ausricht_balkon_terrasse?: AusrichtBalkonTerrasse;
    moebliert?: Moebliert;
    rollstuhlgerecht?: boolean;
    kabel_sat_tv?: boolean;
    dvbt?: boolean;
    barrierefrei?: boolean;
    sauna?: boolean;
    swimmingpool?: boolean;
    wasch_trockenraum?: boolean;
    wintergarten?: boolean;
    dv_verkabelung?: boolean;
    rampe?: boolean;
    hebebuehne?: boolean;
    kran?: boolean;
    gastterrasse?: boolean;
    stromanschlusswert?: string;
    kantine_cafeteria?: boolean;
    teekueche?: boolean;
    hallenhoehe?: number;
    angeschl_gastronomie?: AngeschlGastronomie;
    brauereibindung?: boolean;
    sporteinrichtungen?: boolean;
    wellnessbereich?: boolean;
    serviceleistungen?: Serviceleistungen;
    telefon_ferienimmobilie?: boolean;
    breitband_zugang?: BreitbandZugang;
    umts_empfang?: boolean;
    sicherheitstechnik?: Sicherheitstechnik;
    unterkellert?: Unterkellert;
    abstellraum?: boolean;
    fahrradraum?: boolean;
    rolladen?: boolean;
    bibliothek?: boolean;
    dachboden?: boolean;
    gaestewc?: boolean;
    kabelkanaele?: boolean;
    seniorengerecht?: boolean;
    dachform?: Dachform;
    bauweise?: Bauweise;
    ausbaustufe?: Ausbaustufe;
    energietyp?: Energietyp;
    baujahr?: string;
    letztemodernisierung?: string;
    zustand?: Zustand;
    alter?: Alter;
    bebaubar_nach?: BebaubarNach;
    erschliessung?: Erschliessung;
    erschliessung_umfang?: ErschliessungUmfang;
    bauzone?: string;
    altlasten?: string;
    energiepass?: Energiepass;
    verkaufstatus?: Verkaufstatus;
    zulieferung?: boolean;
    ausblick?: Ausblick;
    distanzen?: Distanzen;
    distanzen_sport?: DistanzenSport;
    objekttitel?: string;
    dreizeiler?: string;
    lage?: string;
    ausstatt_beschr?: string;
    objektbeschreibung?: string;
    sonstige_angaben?: string;
    objekt_text?: ObjektText;
    anhang?: Anhang;
    foto?: Foto;
    anhangtitel?: string;
    format?: string;
    check?: Check;
    daten?: Daten | Daten1;
    anhanginhalt?: Buffer;
    pfad?: string;
    objektadresse_freigeben?: boolean;
    verfuegbar_ab?: string;
    abdatum?: string;
    bisdatum?: string;
    min_mietdauer?: MinMietdauer;
    max_mietdauer?: MaxMietdauer;
    versteigerungstermin?: string;
    wbs_sozialwohnung?: boolean;
    vermietet?: boolean;
    anbieternr?: string;
    objektnr_intern?: string;
    objektnr_extern?: string;
    gruppennummer?: string;
    zugang?: string;
    aktiv_von?: string;
    aktiv_bis?: string;
    laufzeit?: number;
    max_personen?: number;
    nichtraucher?: boolean;
    haustiere?: boolean;
    geschlecht?: Geschlecht;
    denkmalgeschuetzt?: boolean;
    stand_vom?: string;
    kennung_ursprung?: string;
    openimmo_obid?: string;
    weitergabe_generell?: boolean;
    weitergabe_negativ?: string;
    weitergabe_positiv?: string;
    gruppen_kennung?: string;
    sprache?: string;
    master?: Master;
    als_ferien?: boolean;
    gewerbliche_nutzung?: boolean;
    branchen?: string;
    hochhaus?: boolean;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
    aktion?: Aktion;
    zimmer?: Zimmer;
    wohnung?: Wohnung;
    haus?: Haus;
    grundstueck?: Grundstueck;
    buero_praxen?: BueroPraxen;
    einzelhandel?: Einzelhandel;
    gastgewerbe?: Gastgewerbe;
    hallen_lager_prod?: HallenLagerProd;
    land_und_forstwirtschaft?: LandUndForstwirtschaft;
    parken?: Parken;
    sonstige?: Sonstige;
    freizeitimmobilie_gewerblich?: FreizeitimmobilieGewerblich;
    zinshaus_renditeobjekt?: ZinshausRenditeobjekt;
    objektart_zusatz?: string;
    impressum?: string;
    impressum_strukt?: ImpressumStrukt;
    kontakt?: string;
    posdecimal?: number;
    stellplatz?: Stellplatz;
    waehrung?: Waehrung;
    land?: Land;
}
export interface Openimmo {
    uebertragung: Uebertragung;
    anbieter: Anbieter;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
}
export interface Uebertragung {
    art: "ONLINE" | "OFFLINE";
    umfang: "TEIL" | "VOLL";
    modus?: "NEW" | "CHANGE" | "DELETE";
    version: string;
    sendersoftware: string;
    senderversion: string;
    techn_email?: string;
    regi_id?: string;
    timestamp?: string;
}
export interface Anbieter {
    anbieternr?: string;
    firma: string;
    openimmo_anid: string;
    lizenzkennung?: string;
    anhang?: Anhang;
    immobilie?: Immobilie;
    impressum?: string;
    impressum_strukt?: ImpressumStrukt;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Immobilie {
    objektkategorie: Objektkategorie;
    geo: Geo | Geo1 | Geo2;
    kontaktperson: Kontaktperson | Kontaktperson1 | Kontaktperson2 | Kontaktperson3 | Kontaktperson4 | Kontaktperson5;
    weitere_adresse?: WeitereAdresse;
    preise?: Preise;
    bieterverfahren?: Bieterverfahren;
    versteigerung?: Versteigerung;
    flaechen?: Flaechen;
    ausstattung?: Ausstattung;
    zustand_angaben?: ZustandAngaben;
    bewertung?: Bewertung;
    infrastruktur?: Infrastruktur;
    freitexte?: Freitexte;
    anhaenge?: Anhaenge;
    verwaltung_objekt?: VerwaltungObjekt;
    verwaltung_techn: VerwaltungTechn;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Objektkategorie {
    nutzungsart: Nutzungsart;
    vermarktungsart: Vermarktungsart;
    objektart: Objektart | Objektart1 | Objektart2 | Objektart3 | Objektart4 | Objektart5 | Objektart6 | Objektart7 | Objektart8 | Objektart9 | Objektart10 | Objektart11 | Objektart12;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Geo {
    plz: string;
    ort?: string;
    geokoordinaten?: Geokoordinaten;
    strasse?: string;
    hausnummer?: string;
    bundesland?: string;
    land?: Land;
    gemeindecode?: string;
    flur?: string;
    flurstueck?: string;
    gemarkung?: string;
    etage?: number;
    anzahl_etagen?: number;
    lage_im_bau?: LageImBau;
    wohnungsnr?: string;
    lage_gebiet?: LageGebiet;
    regionaler_zusatz?: string;
    karten_makro?: boolean;
    karten_mikro?: boolean;
    virtuelletour?: boolean;
    luftbildern?: boolean;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Geo1 {
    ort: string;
    geokoordinaten?: Geokoordinaten;
    strasse?: string;
    hausnummer?: string;
    bundesland?: string;
    land?: Land;
    gemeindecode?: string;
    flur?: string;
    flurstueck?: string;
    gemarkung?: string;
    etage?: number;
    anzahl_etagen?: number;
    lage_im_bau?: LageImBau;
    wohnungsnr?: string;
    lage_gebiet?: LageGebiet;
    regionaler_zusatz?: string;
    karten_makro?: boolean;
    karten_mikro?: boolean;
    virtuelletour?: boolean;
    luftbildern?: boolean;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Geo2 {
    geokoordinaten: Geokoordinaten;
    strasse?: string;
    hausnummer?: string;
    bundesland?: string;
    land?: Land;
    gemeindecode?: string;
    flur?: string;
    flurstueck?: string;
    gemarkung?: string;
    etage?: number;
    anzahl_etagen?: number;
    lage_im_bau?: LageImBau;
    wohnungsnr?: string;
    lage_gebiet?: LageGebiet;
    regionaler_zusatz?: string;
    karten_makro?: boolean;
    karten_mikro?: boolean;
    virtuelletour?: boolean;
    luftbildern?: boolean;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Kontaktperson {
    email_zentrale: string;
    email_direkt?: string;
    tel_zentrale?: string;
    tel_durchw?: string;
    tel_fax?: string;
    tel_handy?: string;
    name: string;
    vorname?: string;
    titel?: string;
    anrede?: string;
    position?: string;
    anrede_brief?: string;
    firma?: string;
    zusatzfeld?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    postfach?: string;
    postf_plz?: string;
    postf_ort?: string;
    land?: Land;
    email_privat?: string;
    email_sonstige?: EmailSonstige;
    email_feedback?: string;
    tel_privat?: string;
    tel_sonstige?: TelSonstige;
    url?: string;
    adressfreigabe?: boolean;
    personennummer?: string;
    immobilientreuhaenderid?: string;
    foto?: Foto;
    referenz_id?: string;
    freitextfeld?: string;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Kontaktperson1 {
    email_direkt: string;
    tel_zentrale?: string;
    tel_durchw?: string;
    tel_fax?: string;
    tel_handy?: string;
    name: string;
    vorname?: string;
    titel?: string;
    anrede?: string;
    position?: string;
    anrede_brief?: string;
    firma?: string;
    zusatzfeld?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    postfach?: string;
    postf_plz?: string;
    postf_ort?: string;
    land?: Land;
    email_privat?: string;
    email_sonstige?: EmailSonstige;
    email_feedback?: string;
    tel_privat?: string;
    tel_sonstige?: TelSonstige;
    url?: string;
    adressfreigabe?: boolean;
    personennummer?: string;
    immobilientreuhaenderid?: string;
    foto?: Foto;
    referenz_id?: string;
    freitextfeld?: string;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Kontaktperson2 {
    tel_zentrale: string;
    tel_durchw?: string;
    tel_fax?: string;
    tel_handy?: string;
    name: string;
    vorname?: string;
    titel?: string;
    anrede?: string;
    position?: string;
    anrede_brief?: string;
    firma?: string;
    zusatzfeld?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    postfach?: string;
    postf_plz?: string;
    postf_ort?: string;
    land?: Land;
    email_privat?: string;
    email_sonstige?: EmailSonstige;
    email_feedback?: string;
    tel_privat?: string;
    tel_sonstige?: TelSonstige;
    url?: string;
    adressfreigabe?: boolean;
    personennummer?: string;
    immobilientreuhaenderid?: string;
    foto?: Foto;
    referenz_id?: string;
    freitextfeld?: string;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Kontaktperson3 {
    tel_durchw: string;
    tel_fax?: string;
    tel_handy?: string;
    name: string;
    vorname?: string;
    titel?: string;
    anrede?: string;
    position?: string;
    anrede_brief?: string;
    firma?: string;
    zusatzfeld?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    postfach?: string;
    postf_plz?: string;
    postf_ort?: string;
    land?: Land;
    email_privat?: string;
    email_sonstige?: EmailSonstige;
    email_feedback?: string;
    tel_privat?: string;
    tel_sonstige?: TelSonstige;
    url?: string;
    adressfreigabe?: boolean;
    personennummer?: string;
    immobilientreuhaenderid?: string;
    foto?: Foto;
    referenz_id?: string;
    freitextfeld?: string;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Kontaktperson4 {
    tel_fax: string;
    tel_handy?: string;
    name: string;
    vorname?: string;
    titel?: string;
    anrede?: string;
    position?: string;
    anrede_brief?: string;
    firma?: string;
    zusatzfeld?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    postfach?: string;
    postf_plz?: string;
    postf_ort?: string;
    land?: Land;
    email_privat?: string;
    email_sonstige?: EmailSonstige;
    email_feedback?: string;
    tel_privat?: string;
    tel_sonstige?: TelSonstige;
    url?: string;
    adressfreigabe?: boolean;
    personennummer?: string;
    immobilientreuhaenderid?: string;
    foto?: Foto;
    referenz_id?: string;
    freitextfeld?: string;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Kontaktperson5 {
    tel_handy: string;
    name: string;
    vorname?: string;
    titel?: string;
    anrede?: string;
    position?: string;
    anrede_brief?: string;
    firma?: string;
    zusatzfeld?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    postfach?: string;
    postf_plz?: string;
    postf_ort?: string;
    land?: Land;
    email_privat?: string;
    email_sonstige?: EmailSonstige;
    email_feedback?: string;
    tel_privat?: string;
    tel_sonstige?: TelSonstige;
    url?: string;
    adressfreigabe?: boolean;
    personennummer?: string;
    immobilientreuhaenderid?: string;
    foto?: Foto;
    referenz_id?: string;
    freitextfeld?: string;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface WeitereAdresse {
    vorname?: string;
    name?: string;
    titel?: string;
    anrede?: string;
    anrede_brief?: string;
    firma?: string;
    zusatzfeld?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    postfach?: string;
    postf_plz?: string;
    postf_ort?: string;
    land?: Land;
    email_zentrale?: string;
    email_direkt?: string;
    email_privat?: string;
    email_sonstige?: EmailSonstige;
    tel_durchw?: string;
    tel_zentrale?: string;
    tel_handy?: string;
    tel_fax?: string;
    tel_privat?: string;
    tel_sonstige?: TelSonstige;
    url?: string;
    adressfreigabe?: boolean;
    personennummer?: string;
    freitextfeld?: string;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
    adressart: string;
}
export interface Preise {
    kaufpreis?: Kaufpreis;
    kaufpreisnetto?: Kaufpreisnetto;
    kaufpreisbrutto?: number;
    nettokaltmiete?: number;
    kaltmiete?: number;
    warmmiete?: number;
    nebenkosten?: number;
    heizkosten_enthalten?: boolean;
    heizkosten?: number;
    zzg_mehrwertsteuer?: boolean;
    mietzuschlaege?: number;
    hauptmietzinsnetto?: Hauptmietzinsnetto;
    pauschalmiete?: number;
    betriebskostennetto?: Betriebskostennetto;
    evbnetto?: Evbnetto;
    gesamtmietenetto?: Gesamtmietenetto;
    gesamtmietebrutto?: number;
    gesamtbelastungnetto?: Gesamtbelastungnetto;
    gesamtbelastungbrutto?: number;
    gesamtkostenprom2von?: Gesamtkostenprom2von;
    heizkostennetto?: Heizkostennetto;
    monatlichekostennetto?: Monatlichekostennetto;
    monatlichekostenbrutto?: number;
    nebenkostenprom2von?: Nebenkostenprom2von;
    ruecklagenetto?: Ruecklagenetto;
    sonstigekostennetto?: Sonstigekostennetto;
    sonstigemietenetto?: Sonstigemietenetto;
    summemietenetto?: Summemietenetto;
    nettomieteprom2von?: Nettomieteprom2von;
    pacht?: number;
    erbpacht?: number;
    hausgeld?: number;
    abstand?: number;
    preis_zeitraum_von?: string;
    preis_zeitraum_bis?: string;
    preis_zeiteinheit?: PreisZeiteinheit;
    mietpreis_pro_qm?: number;
    kaufpreis_pro_qm?: number;
    provisionspflichtig?: boolean;
    provision_teilen?: ProvisionTeilen;
    innen_courtage?: InnenCourtage;
    aussen_courtage?: AussenCourtage;
    courtage_hinweis?: string;
    provisionnetto?: Provisionnetto;
    provisionbrutto?: number;
    waehrung?: Waehrung;
    mwst_satz?: number;
    mwst_gesamt?: number;
    freitext_preis?: string;
    x_fache?: string;
    nettorendite?: number;
    nettorendite_soll?: number;
    nettorendite_ist?: number;
    mieteinnahmen_ist?: MieteinnahmenIst;
    mieteinnahmen_soll?: MieteinnahmenSoll;
    erschliessungskosten?: number;
    kaution?: number;
    kaution_text?: string;
    geschaeftsguthaben?: number;
    stp_carport?: Stellplatz;
    stp_duplex?: Stellplatz;
    stp_freiplatz?: Stellplatz;
    stp_garage?: Stellplatz;
    stp_parkhaus?: Stellplatz;
    stp_tiefgarage?: Stellplatz;
    stp_sonstige?: StpSonstige;
    richtpreis?: number;
    richtpreisprom2?: number;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Bieterverfahren {
    beginn_angebotsphase?: string;
    besichtigungstermin?: string;
    besichtigungstermin_2?: string;
    beginn_bietzeit?: string;
    ende_bietzeit?: string;
    hoechstgebot_zeigen?: boolean;
    mindestpreis?: number;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Versteigerung {
    zwangsversteigerung?: boolean;
    aktenzeichen?: string;
    zvtermin?: string;
    zusatztermin?: string;
    amtsgericht?: string;
    verkehrswert?: number;
}
export interface Flaechen {
    wohnflaeche?: number;
    nutzflaeche?: number;
    gesamtflaeche?: number;
    ladenflaeche?: number;
    lagerflaeche?: number;
    verkaufsflaeche?: number;
    freiflaeche?: number;
    bueroflaeche?: number;
    bueroteilflaeche?: number;
    fensterfront?: number;
    verwaltungsflaeche?: number;
    gastroflaeche?: number;
    grz?: string;
    gfz?: string;
    bmz?: string;
    bgf?: string;
    grundstuecksflaeche?: number;
    sonstflaeche?: number;
    anzahl_zimmer?: number;
    anzahl_schlafzimmer?: number;
    anzahl_badezimmer?: number;
    anzahl_sep_wc?: number;
    anzahl_balkone?: number;
    anzahl_terrassen?: number;
    anzahl_logia?: number;
    balkon_terrasse_flaeche?: number;
    anzahl_wohn_schlafzimmer?: number;
    gartenflaeche?: number;
    kellerflaeche?: number;
    fensterfront_qm?: number;
    grundstuecksfront?: number;
    dachbodenflaeche?: number;
    teilbar_ab?: number;
    beheizbare_flaeche?: number;
    anzahl_stellplaetze?: number;
    plaetze_gastraum?: number;
    anzahl_betten?: number;
    anzahl_tagungsraeume?: number;
    vermietbare_flaeche?: number;
    anzahl_wohneinheiten?: number;
    anzahl_gewerbeeinheiten?: number;
    einliegerwohnung?: boolean;
    kubatur?: number;
    ausnuetzungsziffer?: number;
    flaechevon?: number;
    flaechebis?: number;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Ausstattung {
    ausstatt_kategorie?: "STANDARD" | "GEHOBEN" | "LUXUS";
    wg_geeignet?: boolean;
    raeume_veraenderbar?: boolean;
    bad?: Bad;
    kueche?: Kueche;
    boden?: Boden;
    kamin?: boolean;
    heizungsart?: Heizungsart;
    befeuerung?: Befeuerung;
    klimatisiert?: boolean;
    fahrstuhl?: Fahrstuhl;
    stellplatzart?: Stellplatzart;
    gartennutzung?: boolean;
    ausricht_balkon_terrasse?: AusrichtBalkonTerrasse;
    moebliert?: Moebliert;
    rollstuhlgerecht?: boolean;
    kabel_sat_tv?: boolean;
    dvbt?: boolean;
    barrierefrei?: boolean;
    sauna?: boolean;
    swimmingpool?: boolean;
    wasch_trockenraum?: boolean;
    wintergarten?: boolean;
    dv_verkabelung?: boolean;
    rampe?: boolean;
    hebebuehne?: boolean;
    kran?: boolean;
    gastterrasse?: boolean;
    stromanschlusswert?: string;
    kantine_cafeteria?: boolean;
    teekueche?: boolean;
    hallenhoehe?: number;
    angeschl_gastronomie?: AngeschlGastronomie;
    brauereibindung?: boolean;
    sporteinrichtungen?: boolean;
    wellnessbereich?: boolean;
    serviceleistungen?: Serviceleistungen;
    telefon_ferienimmobilie?: boolean;
    breitband_zugang?: BreitbandZugang;
    umts_empfang?: boolean;
    sicherheitstechnik?: Sicherheitstechnik;
    unterkellert?: Unterkellert;
    abstellraum?: boolean;
    fahrradraum?: boolean;
    rolladen?: boolean;
    dachform?: Dachform;
    bauweise?: Bauweise;
    ausbaustufe?: Ausbaustufe;
    energietyp?: Energietyp;
    bibliothek?: boolean;
    dachboden?: boolean;
    gaestewc?: boolean;
    kabelkanaele?: boolean;
    seniorengerecht?: boolean;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface ZustandAngaben {
    baujahr?: string;
    letztemodernisierung?: string;
    zustand?: Zustand;
    alter?: Alter;
    bebaubar_nach?: BebaubarNach;
    erschliessung?: Erschliessung;
    erschliessung_umfang?: ErschliessungUmfang;
    bauzone?: string;
    altlasten?: string;
    energiepass?: Energiepass;
    verkaufstatus?: Verkaufstatus;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Feld {
    name: string;
    wert: string;
    typ?: string;
    modus?: string;
}
export interface Bewertung {
    feld?: Feld;
}
export interface Infrastruktur {
    zulieferung?: boolean;
    ausblick?: Ausblick;
    distanzen?: Distanzen;
    distanzen_sport?: DistanzenSport;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Freitexte {
    objekttitel?: string;
    dreizeiler?: string;
    lage?: string;
    ausstatt_beschr?: string;
    objektbeschreibung?: string;
    sonstige_angaben?: string;
    objekt_text?: ObjektText;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Anhaenge {
    anhang?: Anhang;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface VerwaltungObjekt {
    objektadresse_freigeben?: boolean;
    verfuegbar_ab?: string;
    abdatum?: string;
    bisdatum?: string;
    min_mietdauer?: MinMietdauer;
    max_mietdauer?: MaxMietdauer;
    versteigerungstermin?: string;
    wbs_sozialwohnung?: boolean;
    vermietet?: boolean;
    gruppennummer?: string;
    zugang?: string;
    laufzeit?: number;
    max_personen?: number;
    nichtraucher?: boolean;
    haustiere?: boolean;
    geschlecht?: Geschlecht;
    denkmalgeschuetzt?: boolean;
    als_ferien?: boolean;
    gewerbliche_nutzung?: boolean;
    branchen?: string;
    hochhaus?: boolean;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface VerwaltungTechn {
    objektnr_intern?: string;
    objektnr_extern: string;
    aktion: Aktion;
    aktiv_von?: string;
    aktiv_bis?: string;
    openimmo_obid: string;
    kennung_ursprung?: string;
    stand_vom: string;
    weitergabe_generell?: boolean;
    weitergabe_positiv?: string;
    weitergabe_negativ?: string;
    gruppen_kennung?: string;
    master?: Master;
    sprache?: string;
    user_defined_simplefield?: UserDefinedSimplefield;
    user_defined_anyfield?: any;
    user_defined_extend?: UserDefinedExtend;
}
export interface Geokoordinaten {
    breitengrad: number;
    laengengrad: number;
}
export interface LageImBau {
    LINKS?: boolean;
    RECHTS?: boolean;
    VORNE?: boolean;
    HINTEN?: boolean;
}
export interface LageGebiet {
    gebiete?: "WOHN" | "GEWERBE" | "INDUSTRIE" | "MISCH" | "NEUBAU" | "ORTSLAGE" | "SIEDLUNG" | "STADTRAND" | "STADTTEIL" | "STADTZENTRUM" | "NEBENZENTRUM" | "1A" | "1B";
}
export interface EmailSonstige {
    emailart?: "EM_ZENTRALE" | "EM_DIREKT" | "EM_PRIVAT" | "EM_SONSTIGE";
    bemerkung?: string;
    email_sonstige: string;
}
export interface TelSonstige {
    telefonart?: "TEL_ZENTRALE" | "TEL_DURCHW" | "TEL_PRIVAT" | "TEL_HANDY" | "TEL_FAX" | "TEL_SONSTIGE";
    bemerkung?: string;
    tel_sonstige: string;
}
export interface Objektart {
    zimmer: Zimmer;
    objektart_zusatz?: string;
}
export interface Objektart1 {
    wohnung: Wohnung;
    objektart_zusatz?: string;
}
export interface Objektart2 {
    haus: Haus;
    objektart_zusatz?: string;
}
export interface Objektart3 {
    grundstueck: Grundstueck;
    objektart_zusatz?: string;
}
export interface Objektart4 {
    buero_praxen: BueroPraxen;
    objektart_zusatz?: string;
}
export interface Objektart5 {
    einzelhandel: Einzelhandel;
    objektart_zusatz?: string;
}
export interface Objektart6 {
    gastgewerbe: Gastgewerbe;
    objektart_zusatz?: string;
}
export interface Objektart7 {
    hallen_lager_prod: HallenLagerProd;
    objektart_zusatz?: string;
}
export interface Objektart8 {
    land_und_forstwirtschaft: LandUndForstwirtschaft;
    objektart_zusatz?: string;
}
export interface Objektart9 {
    parken: Parken;
    objektart_zusatz?: string;
}
export interface Objektart10 {
    sonstige: Sonstige;
    objektart_zusatz?: string;
}
export interface Objektart11 {
    freizeitimmobilie_gewerblich: FreizeitimmobilieGewerblich;
    objektart_zusatz?: string;
}
export interface Objektart12 {
    zinshaus_renditeobjekt: ZinshausRenditeobjekt;
    objektart_zusatz?: string;
}
export interface Vermarktungsart {
    KAUF: boolean;
    MIETE_PACHT: boolean;
    ERBPACHT?: boolean;
    LEASING?: boolean;
}
export interface Nutzungsart {
    WOHNEN: boolean;
    GEWERBE: boolean;
    ANLAGE?: boolean;
    WAZ?: boolean;
}
export interface Hauptmietzinsnetto {
    hauptmietzinsust?: number;
    hauptmietzinsnetto: number;
}
export interface Betriebskostennetto {
    betriebskostenust?: number;
    betriebskostennetto: number;
}
export interface Evbnetto {
    evbust?: number;
    evbnetto: number;
}
export interface Gesamtmietenetto {
    gesamtmieteust?: number;
    gesamtmietenetto: number;
}
export interface Gesamtbelastungnetto {
    gesamtbelastungust?: number;
    gesamtbelastungnetto: number;
}
export interface Gesamtkostenprom2von {
    gesamtkostenprom2bis?: number;
    gesamtkostenprom2von: number;
}
export interface Heizkostennetto {
    heizkostenust?: number;
    heizkostennetto: number;
}
export interface Kaufpreisnetto {
    kaufpreisust?: number;
    kaufpreisnetto: number;
}
export interface Monatlichekostennetto {
    monatlichekostenust?: number;
    monatlichekostennetto: number;
}
export interface Nebenkostenprom2von {
    nebenkostenprom2bis?: number;
    nebenkostenprom2von: number;
}
export interface Nettomieteprom2von {
    nettomieteprom2bis?: number;
    nettomieteprom2von: number;
}
export interface Provisionnetto {
    provisionust?: number;
    provisionnetto: number;
}
export interface Ruecklagenetto {
    ruecklageust?: number;
    ruecklagenetto: number;
}
export interface Sonstigekostennetto {
    sonstigekostenust?: number;
    sonstigekostennetto: number;
}
export interface Sonstigemietenetto {
    sonstigemieteust?: number;
    sonstigemietenetto: number;
}
export interface Summemietenetto {
    summemieteust?: number;
    summemietenetto: number;
}
export interface Kaufpreis {
    auf_anfrage?: boolean;
    kaufpreis: number;
}
export interface PreisZeiteinheit {
    zeiteinheit?: "TAG" | "WOCHE" | "MONAT" | "JAHR";
}
export interface StpSonstige extends Stellplatz {
    platzart?: "FREIPLATZ" | "GARAGE" | "TIEFGARAGE" | "CARPORT" | "DUPLEX" | "PARKHAUS" | "SONSTIGES";
    bemerkung?: string;
}
export interface ProvisionTeilen {
    wert?: "absolut" | "prozent" | "text";
}
export interface AussenCourtage {
    mit_mwst?: boolean;
}
export interface InnenCourtage {
    mit_mwst?: boolean;
}
export interface MieteinnahmenIst {
    periode?: "TAG" | "WOCHE" | "MONAT" | "JAHR";
    mieteinnahmen_ist: number;
}
export interface MieteinnahmenSoll {
    periode?: "TAG" | "WOCHE" | "MONAT" | "JAHR";
    mieteinnahmen_soll: number;
}
export interface Bad {
    DUSCHE?: boolean;
    WANNE?: boolean;
    FENSTER?: boolean;
    BIDET?: boolean;
    PISSOIR?: boolean;
}
export interface Kueche {
    EBK?: boolean;
    OFFEN?: boolean;
    PANTRY?: boolean;
}
export interface Boden {
    FLIESEN?: boolean;
    STEIN?: boolean;
    TEPPICH?: boolean;
    PARKETT?: boolean;
    FERTIGPARKETT?: boolean;
    LAMINAT?: boolean;
    DIELEN?: boolean;
    KUNSTSTOFF?: boolean;
    ESTRICH?: boolean;
    DOPPELBODEN?: boolean;
    LINOLEUM?: boolean;
    MARMOR?: boolean;
    TERRAKOTTA?: boolean;
    GRANIT?: boolean;
}
export interface Heizungsart {
    OFEN?: boolean;
    ETAGE?: boolean;
    ZENTRAL?: boolean;
    FERN?: boolean;
    FUSSBODEN?: boolean;
}
export interface Befeuerung {
    OEL?: boolean;
    GAS?: boolean;
    ELEKTRO?: boolean;
    ALTERNATIV?: boolean;
    SOLAR?: boolean;
    ERDWAERME?: boolean;
    LUFTWP?: boolean;
    FERN?: boolean;
    BLOCK?: boolean;
    'WASSER-ELEKTRO'?: boolean;
    PELLET?: boolean;
    KOHLE?: boolean;
    HOLZ?: boolean;
    FLUESSIGGAS?: boolean;
}
export interface Fahrstuhl {
    PERSONEN?: boolean;
    LASTEN?: boolean;
}
export interface Stellplatzart {
    GARAGE?: boolean;
    TIEFGARAGE?: boolean;
    CARPORT?: boolean;
    FREIPLATZ?: boolean;
    PARKHAUS?: boolean;
    DUPLEX?: boolean;
}
export interface AusrichtBalkonTerrasse {
    NORD?: boolean;
    OST?: boolean;
    SUED?: boolean;
    WEST?: boolean;
    NORDOST?: boolean;
    NORDWEST?: boolean;
    SUEDOST?: boolean;
    SUEDWEST?: boolean;
}
export interface Moebliert {
    moeb?: "VOLL" | "TEIL";
}
export interface AngeschlGastronomie {
    HOTELRESTAURANT?: boolean;
    BAR?: boolean;
}
export interface Serviceleistungen {
    BETREUTES_WOHNEN?: boolean;
    CATERING?: boolean;
    REINIGUNG?: boolean;
    EINKAUF?: boolean;
    WACHDIENST?: boolean;
}
export interface BreitbandZugang {
    art?: string;
    speed?: number;
}
export interface Sicherheitstechnik {
    ALARMANLAGE?: boolean;
    KAMERA?: boolean;
    POLIZEIRUF?: boolean;
}
export interface Unterkellert {
    keller?: "JA" | "NEIN" | "TEIL";
}
export interface Dachform {
    KRUEPPELWALMDACH?: boolean;
    MANSARDDACH?: boolean;
    PULTDACH?: boolean;
    SATTELDACH?: boolean;
    WALMDACH?: boolean;
    FLACHDACH?: boolean;
    PYRAMIDENDACH?: boolean;
}
export interface Bauweise {
    MASSIV?: boolean;
    FERTIGTEILE?: boolean;
    HOLZ?: boolean;
}
export interface Ausbaustufe {
    BAUSATZHAUS?: boolean;
    AUSBAUHAUS?: boolean;
    SCHLUESSELFERTIGMITKELLER?: boolean;
    SCHLUESSELFERTIGOHNEBODENPLATTE?: boolean;
    SCHLUESSELFERTIGMITBODENPLATTE?: boolean;
}
export interface Energietyp {
    PASSIVHAUS?: boolean;
    NIEDRIGENERGIE?: boolean;
    NEUBAUSTANDARD?: boolean;
    KFW40?: boolean;
    KFW60?: boolean;
    KFW55?: boolean;
    KFW70?: boolean;
    MINERGIEBAUWEISE?: boolean;
    MINERGIE_ZERTIFIZIERT?: boolean;
}
export interface Zustand {
    zustand_art?: "ERSTBEZUG" | "TEIL_VOLLRENOVIERUNGSBED" | "NEUWERTIG" | "TEIL_VOLLSANIERT" | "TEIL_VOLLRENOVIERT" | "TEIL_SANIERT" | "VOLL_SANIERT" | "SANIERUNGSBEDUERFTIG" | "BAUFAELLIG" | "NACH_VEREINBARUNG" | "MODERNISIERT" | "GEPFLEGT" | "ROHBAU" | "ENTKERNT" | "ABRISSOBJEKT" | "PROJEKTIERT";
}
export interface Alter {
    alter_attr?: "ALTBAU" | "NEUBAU";
}
export interface BebaubarNach {
    bebaubar_attr?: "34_NACHBARSCHAFT" | "35_AUSSENGEBIET" | "B_PLAN" | "KEIN BAULAND" | "BAUERWARTUNGSLAND" | "LAENDERSPEZIFISCH" | "BAULAND_OHNE_B_PLAN";
}
export interface Erschliessung {
    erschl_attr?: "UNERSCHLOSSEN" | "TEILERSCHLOSSEN" | "VOLLERSCHLOSSEN" | "ORTSUEBLICHERSCHLOSSEN";
}
export interface ErschliessungUmfang {
    erschl_attr?: "GAS" | "WASSER" | "STROM" | "TK";
}
export interface Energiepass {
    epart?: "BEDARF" | "VERBRAUCH";
    gueltig_bis?: string;
    energieverbrauchkennwert?: string;
    mitwarmwasser?: boolean;
    endenergiebedarf?: string;
    primaerenergietraeger?: string;
    stromwert?: string;
    waermewert?: string;
    wertklasse?: string;
    baujahr?: string;
    ausstelldatum?: string;
    jahrgang?: "2008" | "2014" | "ohne" | "nicht_noetig" | "bei_besichtigung";
    gebaeudeart?: "wohn" | "nichtwohn";
    epasstext?: string;
    geg2018?: string;
    hwbwert?: string;
    hwbklasse?: string;
    fgeewert?: string;
    fgeeklasse?: string;
}
export interface Verkaufstatus {
    stand?: "OFFEN" | "RESERVIERT" | "VERKAUFT";
}
export interface Ausblick {
    blick?: "FERNE" | "SEE" | "BERGE" | "MEER";
}
export interface Distanzen {
    distanz_zu: "FLUGHAFEN" | "FERNBAHNHOF" | "AUTOBAHN" | "US_BAHN" | "BUS" | "KINDERGAERTEN" | "GRUNDSCHULE" | "HAUPTSCHULE" | "REALSCHULE" | "GESAMTSCHULE" | "GYMNASIUM" | "ZENTRUM" | "EINKAUFSMOEGLICHKEITEN" | "GASTSTAETTEN";
    distanzen: number;
}
export interface DistanzenSport {
    distanz_zu_sport: "STRAND" | "SEE" | "MEER" | "SKIGEBIET" | "SPORTANLAGEN" | "WANDERGEBIETE" | "NAHERHOLUNG";
    distanzen_sport: number;
}
export interface ObjektText {
    lang: string;
}
export interface Anhang {
    anhangtitel?: string;
    format: string;
    check?: Check;
    daten: Daten | Daten1;
    location: "INTERN" | "EXTERN" | "REMOTE";
    gruppe?: "TITELBILD" | "INNENANSICHTEN" | "AUSSENANSICHTEN" | "GRUNDRISS" | "KARTEN_LAGEPLAN" | "ANBIETERLOGO" | "BILD" | "DOKUMENTE" | "LINKS" | "PANORAMA" | "QRCODE" | "FILM" | "FILMLINK" | "EPASS-SKALA" | "ANBOBJURL";
}
export interface Foto {
    format: string;
    daten: Daten | Daten1;
    location: "EXTERN" | "REMOTE";
}
export interface Check {
    ctype: "MD5" | "DATETIME" | "ETAG";
    check: string;
}
export interface Daten {
    pfad?: string;
}
export interface Daten1 {
    anhanginhalt?: Buffer;
}
export interface MinMietdauer {
    min_dauer?: "TAG" | "WOCHE" | "MONAT" | "JAHR";
}
export interface MaxMietdauer {
    max_dauer?: "TAG" | "WOCHE" | "MONAT" | "JAHR";
}
export interface Geschlecht {
    geschl_attr?: "EGAL" | "NUR_MANN" | "NUR_FRAU";
}
export interface Master {
    visible: boolean;
}
export interface UserDefinedSimplefield {
    feldname: string;
}
export interface UserDefinedExtend {
    feld?: Feld;
}
export interface Aktion {
    aktionart?: "CHANGE" | "DELETE" | "REFERENZ";
}
export interface Zimmer {
    zimmertyp?: "ZIMMER";
}
export interface Wohnung {
    wohnungtyp?: "DACHGESCHOSS" | "MAISONETTE" | "LOFT-STUDIO-ATELIER" | "PENTHOUSE" | "TERRASSEN" | "ETAGE" | "ERDGESCHOSS" | "SOUTERRAIN" | "APARTMENT" | "FERIENWOHNUNG" | "GALERIE" | "ROHDACHBODEN" | "ATTIKAWOHNUNG" | "KEINE_ANGABE";
}
export interface Haus {
    haustyp?: "REIHENHAUS" | "REIHENEND" | "REIHENMITTEL" | "REIHENECK" | "DOPPELHAUSHAELFTE" | "EINFAMILIENHAUS" | "STADTHAUS" | "BUNGALOW" | "VILLA" | "RESTHOF" | "BAUERNHAUS" | "LANDHAUS" | "SCHLOSS" | "ZWEIFAMILIENHAUS" | "MEHRFAMILIENHAUS" | "FERIENHAUS" | "BERGHUETTE" | "CHALET" | "STRANDHAUS" | "LAUBE-DATSCHE-GARTENHAUS" | "APARTMENTHAUS" | "BURG" | "HERRENHAUS" | "FINCA" | "RUSTICO" | "FERTIGHAUS" | "KEINE_ANGABE";
}
export interface Grundstueck {
    grundst_typ?: "WOHNEN" | "GEWERBE" | "INDUSTRIE" | "LAND_FORSTWIRSCHAFT" | "FREIZEIT" | "GEMISCHT" | "GEWERBEPARK" | "SONDERNUTZUNG" | "SEELIEGENSCHAFT";
}
export interface BueroPraxen {
    buero_typ?: "BUEROFLAECHE" | "BUEROHAUS" | "BUEROZENTRUM" | "LOFT_ATELIER" | "PRAXIS" | "PRAXISFLAECHE" | "PRAXISHAUS" | "AUSSTELLUNGSFLAECHE" | "COWORKING" | "SHARED_OFFICE";
}
export interface Einzelhandel {
    handel_typ?: "LADENLOKAL" | "EINZELHANDELSLADEN" | "VERBRAUCHERMARKT" | "EINKAUFSZENTRUM" | "KAUFHAUS" | "FACTORY_OUTLET" | "KIOSK" | "VERKAUFSFLAECHE" | "AUSSTELLUNGSFLAECHE";
}
export interface Gastgewerbe {
    gastgew_typ?: "GASTRONOMIE" | "GASTRONOMIE_UND_WOHNUNG" | "PENSIONEN" | "HOTELS" | "WEITERE_BEHERBERGUNGSBETRIEBE" | "BAR" | "CAFE" | "DISCOTHEK" | "RESTAURANT" | "RAUCHERLOKAL" | "EINRAUMLOKAL";
}
export interface HallenLagerProd {
    hallen_typ?: "HALLE" | "INDUSTRIEHALLE" | "LAGER" | "LAGERFLAECHEN" | "LAGER_MIT_FREIFLAECHE" | "HOCHREGALLAGER" | "SPEDITIONSLAGER" | "PRODUKTION" | "WERKSTATT" | "SERVICE" | "FREIFLAECHEN" | "KUEHLHAUS";
}
export interface LandUndForstwirtschaft {
    land_typ?: "LANDWIRTSCHAFTLICHE_BETRIEBE" | "BAUERNHOF" | "AUSSIEDLERHOF" | "GARTENBAU" | "ACKERBAU" | "WEINBAU" | "VIEHWIRTSCHAFT" | "JAGD_UND_FORSTWIRTSCHAFT" | "TEICH_UND_FISCHWIRTSCHAFT" | "SCHEUNEN" | "REITERHOEFE" | "SONSTIGE_LANDWIRTSCHAFTSIMMOBILIEN" | "ANWESEN" | "JAGDREVIER";
}
export interface Parken {
    parken_typ?: "STELLPLATZ" | "CARPORT" | "DOPPELGARAGE" | "DUPLEX" | "TIEFGARAGE" | "BOOTSLIEGEPLATZ" | "EINZELGARAGE" | "PARKHAUS" | "TIEFGARAGENSTELLPLATZ" | "PARKPLATZ_STROM";
}
export interface Sonstige {
    sonstige_typ?: "PARKHAUS" | "TANKSTELLE" | "KRANKENHAUS" | "SONSTIGE";
}
export interface FreizeitimmobilieGewerblich {
    freizeit_typ?: "SPORTANLAGEN" | "VERGNUEGUNGSPARKS_UND_CENTER" | "FREIZEITANLAGE";
}
export interface ZinshausRenditeobjekt {
    zins_typ?: "MEHRFAMILIENHAUS" | "WOHN_UND_GESCHAEFTSHAUS" | "GESCHAEFTSHAUS" | "BUEROGEBAEUDE" | "SB_MAERKTE" | "EINKAUFSCENTREN" | "WOHNANLAGEN" | "VERBRAUCHERMAERKTE" | "INDUSTRIEANLAGEN" | "PFLEGEHEIM" | "SANATORIUM" | "SENIORENHEIM" | "BETREUTES-WOHNEN";
}
export interface ImpressumStrukt {
    firmenname: string;
    firmenanschrift: string;
    telefon: string;
    vertretungsberechtigter: string;
    berufsaufsichtsbehoerde: string;
    handelsregister: string;
    handelsregister_nr: string;
    'umsst-id': string;
    steuernummer: string;
    weiteres: string;
}
export interface Stellplatz {
    stellplatzmiete?: number;
    stellplatzkaufpreis?: number;
    anzahl?: number;
}
export interface Waehrung {
    iso_waehrung?: "AED" | "AFA" | "ALL" | "AMD" | "ANG" | "AON" | "ARP" | "ATS" | "AUD" | "AWF" | "AZM" | "BAK" | "BBD" | "BDT" | "BEF" | "BGL" | "BHD" | "BIF" | "BMD" | "BND" | "BOB" | "BES" | "BRL" | "BSD" | "BTR" | "BWP" | "BYR" | "BZD" | "CAD" | "CDF" | "CHF" | "CLP" | "CNY" | "COP" | "CRC" | "CZK" | "CUP" | "CVE" | "CUW" | "CYP" | "DEM" | "DJF" | "DKK" | "DOP" | "DZD" | "ECS" | "EEK" | "EGP" | "ERN" | "ESP" | "ETB" | "EUR" | "FIM" | "FJD" | "FKP" | "FRF" | "GBP" | "GEL" | "GHC" | "GIP" | "GMD" | "GNF" | "GRD" | "GTQ" | "GYD" | "HKD" | "HNL" | "HRK" | "HTG" | "HUF" | "IDR" | "IEP" | "IEP" | "ILS" | "INR" | "IQD" | "IRR" | "ISK" | "ITL" | "JMD" | "JOD" | "JPY" | "KES" | "KGS" | "KHR" | "KMF" | "KPW" | "KRW" | "KWD" | "KYD" | "KZT" | "LAK" | "LBP" | "LKR" | "LRD" | "LSL" | "LTL" | "LUF" | "LVL" | "LYD" | "MAD" | "MDL" | "MGF" | "MMK" | "MNT" | "MOP" | "MRO" | "MTL" | "MUR" | "MVR" | "MWK" | "MXP" | "MYR" | "MZM" | "NAD" | "NGN" | "NIO" | "NLG" | "NOK" | "NPR" | "NZD" | "OMR" | "PAB" | "PEN" | "PGK" | "PHP" | "PKR" | "PLZ" | "PTE" | "PYG" | "QAR" | "ROL" | "RUR" | "RWF" | "SAR" | "SBD" | "SBL" | "SCR" | "SDD" | "SEK" | "SGD" | "SHP" | "SIT" | "SKK" | "SLL" | "SOS" | "SRG" | "STD" | "SVC" | "SYP" | "SZL" | "THB" | "TJR" | "TMM" | "TND" | "TOP" | "TRL" | "TTD" | "TWD" | "TZS" | "UAH" | "UGX" | "USD" | "UYU" | "UZS" | "VEB" | "VND" | "VUV" | "WST" | "XAF" | "XAG" | "XAU" | "XCD" | "XCO" | "XDR" | "XPD" | "XPF" | "XPT" | "YER" | "YUN" | "ZAR" | "ZMK" | "ZWD";
}
export interface Land {
    iso_land?: "AFG" | "ALB" | "DZA" | "ASM" | "AND" | "AGO" | "AIA" | "ATG" | "ARG" | "ARM" | "ABW" | "AUS" | "AUT" | "AZE" | "BHS" | "BHR" | "BGD" | "BRB" | "BLR" | "BEL" | "BLZ" | "BEN" | "BMU" | "BTN" | "BOL" | "BIH" | "BWA" | "BRA" | "VGB" | "BRN" | "BGR" | "BFA" | "BDI" | "KHM" | "CMR" | "CAN" | "CPV" | "CYM" | "CAF" | "TCD" | "CHL" | "CHN" | "HKG" | "MAC" | "COL" | "COM" | "COG" | "COK" | "CRI" | "CIV" | "HRV" | "CUB" | "CYP" | "CZE" | "PRK" | "COD" | "DNK" | "DJI" | "DMA" | "DOM" | "TMP" | "ECU" | "EGY" | "SLV" | "GNQ" | "ERI" | "EST" | "ETH" | "FRO" | "FLK" | "FJI" | "FIN" | "FRA" | "GUF" | "PYF" | "GAB" | "GMB" | "GEO" | "DEU" | "GHA" | "GIB" | "GRC" | "GRL" | "GRD" | "GLP" | "GUM" | "GTM" | "GIN" | "GNB" | "GUY" | "HTI" | "VAT" | "HND" | "HUN" | "ISL" | "IND" | "IDN" | "IRN" | "IRQ" | "IRL" | "ISR" | "ITA" | "JAM" | "JPN" | "JOR" | "KAZ" | "KEN" | "KIR" | "KWT" | "KGZ" | "LAO" | "LVA" | "LBN" | "LSO" | "LBR" | "LBY" | "LIE" | "LTU" | "LUX" | "MDG" | "MWI" | "MYS" | "MDV" | "MLI" | "MLT" | "MHL" | "MTQ" | "MRT" | "MUS" | "MEX" | "FSM" | "MCO" | "MNG" | "MNE" | "MSR" | "MAR" | "MOZ" | "MMR" | "NAM" | "NRU" | "NPL" | "NLD" | "ANT" | "NCL" | "NZL" | "NIC" | "NER" | "NGA" | "NIU" | "NFK" | "MNP" | "NOR" | "PSE" | "OMN" | "PAK" | "PLW" | "PAN" | "PNG" | "PRY" | "PER" | "PHL" | "PCN" | "POL" | "PRT" | "PRI" | "QAT" | "KOR" | "MDA" | "REU" | "ROM" | "RUS" | "RWA" | "SHN" | "KNA" | "LCA" | "SPM" | "VCT" | "WSM" | "SMR" | "STP" | "SAU" | "SEN" | "SRB" | "SYC" | "SLE" | "SGP" | "SMX" | "SVK" | "SVN" | "SLB" | "SOM" | "ZAF" | "ESP" | "LKA" | "SDN" | "SUR" | "SJM" | "SWZ" | "SWE" | "CHE" | "SYR" | "TWN" | "TJK" | "THA" | "MKD" | "TGO" | "TKL" | "TON" | "TTO" | "TUN" | "TUR" | "TKM" | "TCA" | "TUV" | "UGA" | "UKR" | "ARE" | "GBR" | "TZA" | "USA" | "VIR" | "URY" | "UZB" | "VUT" | "VEN" | "VNM" | "WLF" | "ESH" | "YEM" | "YUG" | "ZMB" | "ZWE";
}
