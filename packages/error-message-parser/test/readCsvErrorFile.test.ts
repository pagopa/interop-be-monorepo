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
  });

  it("should throw an error if the file is missing", () => {
    expect(() => readCsvErrorFile("./missing.csv", ["it", "en"])).toThrow(
      /no such file or directory/
    );
  });
});
