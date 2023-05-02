import stubInterfaces from "./stubs/interfaces.json";
import extractFields from "../src/extract-fields";
import { join } from "path";
import assert from "assert";

const xsdFilePath = join(__dirname, "assets", "openimmo_127b.xsd");

describe("Generate command", () => {
    it("given same xsd yeld same interfaces declarations", () => {
        const interfaces = extractFields(xsdFilePath);

        assert.equal(
            JSON.stringify(interfaces),
            JSON.stringify(stubInterfaces)
        );
    });
});
