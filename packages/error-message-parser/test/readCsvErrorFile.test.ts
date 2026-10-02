import { describe, afterEach, it, expect } from "vitest";

import { readCsvErrorFile } from "../src/index.js";
import { deleteCsvFiles, createTestCsvFile } from "./utils.js";

describe("readCsvErrorFile", () => {
  afterEach(() => {
    deleteCsvFiles();
  });

  describe("should correctly parse a CSV error file", () => {
    it("when given a valid CSV error file", () => {
      const csvPath = createTestCsvFile([
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId",
          en: "Some error message",
          it: "Un messaggio di errore",
        },
      ]);
      const parsedErrors = readCsvErrorFile(csvPath, ["it", "en"]);
      expect(parsedErrors).toEqual({
        "GET /tenant/:tenantId": {
          "005-0014": {
            key: "005-0014",
            messages: {
              it: "Un messaggio di errore",
              en: "Some error message",
            },
          },
        },
      });
    });

    it("and should skip rows with errors", () => {
      const csvPath = createTestCsvFile([
        {
          process: "tenantProcess",
          errorCode: "nonexistentErrorCode",
          methodUrl: "GET /tenant/:tenantId/first",
          en: "Some error message",
          it: "Un messaggio di errore",
        },
        {
          process: "unknownProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId/second",
          en: "Some error message",
          it: "Un messaggio di errore",
        },
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "wrongUrl",
          en: "Some error message",
          it: "Un messaggio di errore",
        },
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId",
          en: "Some error message",
          it: "Un messaggio di errore",
        },
      ]);
      const parsedErrors = readCsvErrorFile(csvPath, ["it", "en"]);
      expect(parsedErrors).toEqual({
        "GET /tenant/:tenantId": {
          "005-0014": {
            key: "005-0014",
            messages: {
              it: "Un messaggio di errore",
              en: "Some error message",
            },
          },
        },
      });
    });

    it("with extra columns", () => {
      const csvPath = createTestCsvFile([
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId",
          notes: "Some additional notes",
          en: "Some error message",
          it: "Un messaggio di errore",
          "Some extra column": "Some extra value",
        },
      ]);
      const parsedErrors = readCsvErrorFile(csvPath, ["it", "en"]);
      expect(parsedErrors).toEqual({
        "GET /tenant/:tenantId": {
          "005-0014": {
            key: "005-0014",
            messages: {
              it: "Un messaggio di errore",
              en: "Some error message",
            },
          },
        },
      });
    });

    it("with different language column names", () => {
      const csvPath = createTestCsvFile([
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId",
          notes: "Some additional notes",
          "Copy EN": "Some error message",
          "Copy it": "Un messaggio di errore",
        },
      ]);
      const parsedErrors = readCsvErrorFile(csvPath, ["it", "en"]);
      expect(parsedErrors).toEqual({
        "GET /tenant/:tenantId": {
          "005-0014": {
            key: "005-0014",
            messages: {
              it: "Un messaggio di errore",
              en: "Some error message",
            },
          },
        },
      });
    });

    it("and should skip unknown languages", () => {
      const csvPath = createTestCsvFile([
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId",
          en: "Some error message",
          it: "Un messaggio di errore",
          fr: "Un message d'erreur en français",
        },
      ]);
      const parsedErrors = readCsvErrorFile(csvPath, ["it", "en"]);
      expect(parsedErrors).toEqual({
        "GET /tenant/:tenantId": {
          "005-0014": {
            key: "005-0014",
            messages: {
              it: "Un messaggio di errore",
              en: "Some error message",
            },
          },
        },
      });
    });

    it("even if an optional language column is empty", () => {
      const csvPath = createTestCsvFile([
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId",
          en: "",
          it: "Un messaggio di errore",
        },
      ]);
      const parsedErrors = readCsvErrorFile(csvPath, ["it", "en"]);
      expect(parsedErrors).toEqual({
        "GET /tenant/:tenantId": {
          "005-0014": {
            key: "005-0014",
            messages: {
              it: "Un messaggio di errore",
            },
          },
        },
      });
    });

    it("and skip rows where Italian message is missing", () => {
      const csvPath = createTestCsvFile([
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId/missing",
          en: "Some error message",
          it: "",
        },
        {
          process: "tenantProcess",
          errorCode: "certifiedAttributeAlreadyAssigned",
          methodUrl: "GET /tenant/:tenantId",
          en: "Some error message",
          it: "Un messaggio di errore",
        },
      ]);
      const parsedErrors = readCsvErrorFile(csvPath, ["it", "en"]);
      expect(parsedErrors).toEqual({
        "GET /tenant/:tenantId": {
          "005-0014": {
            key: "005-0014",
            messages: {
              it: "Un messaggio di errore",
              en: "Some error message",
            },
          },
        },
      });
    });

    it.each([
      {
        process: "tenantProcess",
        errorCode: "attributeNotFound",
        expected: "005-0001",
      },
      {
        process: "Tenant Process",
        errorCode: "attributeNotFound",
        expected: "005-0001",
      },
      {
        process: "Purpose-template Process",
        errorCode: "missingFreeOfChargeReason",
        expected: "015-0001",
      },
      {
        process: "Purpose Template Process",
        errorCode: "missingFreeOfChargeReason",
        expected: "015-0001",
      },
      {
        process: "PurposeTemplate Process",
        errorCode: "missingFreeOfChargeReason",
        expected: "015-0001",
      },
      {
        process: "Purpose TemplateProcess",
        errorCode: "missingFreeOfChargeReason",
        expected: "015-0001",
      },
      {
        process: "Purpose Process",
        errorCode: "purposeNotFound",
        expected: "004-0001",
      },
      {
        process: "notification-config process",
        errorCode: "tenantNotificationConfigNotFound",
        expected: "014-0001",
      },
      {
        process: "e-service template process",
        errorCode: "eserviceTemplateNotFound",
        expected: "011-0001",
      },
      {
        process: "EService Template Process",
        errorCode: "eserviceTemplateNotFound",
        expected: "011-0001",
      },
      {
        process: "DELEGATION PROCESS",
        errorCode: "delegationNotFound",
        expected: "010-0001",
      },
      {
        process: "Catalog Process",
        errorCode: "eServiceDescriptorNotFound",
        expected: "001-0001",
      },
      {
        process: "Authorization Process",
        errorCode: "clientNotFound",
        expected: "006-0001",
      },
      {
        process: "Attribute Registry Process",
        errorCode: "attributeNotFound",
        expected: "003-0001",
      },
      {
        process: "Agreement Process",
        errorCode: "missingCertifiedAttributesError",
        expected: "002-0001",
      },
    ])(
      "and correctly map error codes for process $process",
      ({ process, errorCode, expected }) => {
        const csvPath = createTestCsvFile([
          {
            process,
            errorCode,
            methodUrl: "GET /tenant/:tenantId",
            en: "Some error message",
            it: "Un messaggio di errore",
          },
        ]);
        const parsedErrors = readCsvErrorFile(csvPath, ["it", "en"]);
        const expectedErrors = {
          "GET /tenant/:tenantId": {
            [expected]: {
              key: expected,
              messages: {
                it: "Un messaggio di errore",
                en: "Some error message",
              },
            },
          },
        };
        expect(parsedErrors).toEqual(expectedErrors);
      }
    );
  });

  it("should throw an error if the file is missing", () => {
    expect(() => readCsvErrorFile("./missing.csv", ["it", "en"])).toThrow(
      /no such file or directory/
    );
  });
});
