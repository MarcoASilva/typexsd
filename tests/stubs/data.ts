import type { Schema } from './openimmo.interfaces';

/** The data behind `tests/assets/stub.xml`, typed by the generated interfaces. */
export const stubXmlObject: Schema = {
    openimmo: {
        uebertragung: {
            art: 'ONLINE',
            sendersoftware: 'my-software',
            senderversion: 'v1',
            umfang: 'TEIL',
            version: '1.0',
        },
        anbieter: [
            {
                firma: 'Joe LLC',
                openimmo_anid: 'UH321890UA9',
                immobilie: [
                    {
                        kontaktperson: {
                            email_zentrale: 'test@test.test',
                            name: 'Testson',
                            email_sonstige: [
                                {
                                    email_sonstige: 'test2@test.test',
                                    bemerkung: 'test',
                                    emailart: 'EM_PRIVAT',
                                },
                            ],
                        },
                        preise: {
                            hauptmietzinsnetto: {
                                hauptmietzinsnetto: 777,
                                hauptmietzinsust: 123,
                            },
                        },
                    } as NonNullable<
                        NonNullable<
                            Schema['openimmo']
                        >['anbieter'][number]['immobilie']
                    >[number],
                ],
            },
        ],
    },
};
