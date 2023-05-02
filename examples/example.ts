import { writeFileSync } from "fs";
import { createBuilder } from "../src";
import { Schema } from "./interfaces";

const schema: Schema = {
    openimmo: {
        uebertragung: {
            art: "ONLINE",
            sendersoftware: "my-software",
            senderversion: "v1",
            umfang: "TEIL",
            version: "1.0",
        },
        anbieter: {
            firma: "Joe LLC",
            openimmo_anid: "UH321890UA9",
        },
    },
};

const build = createBuilder({ xsdFilePath: "openimmo_127b.xsd" });

const xml = build(schema, "openimmo");

writeFileSync("output.xml", xml);
