import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { toCsvDataRow } from "../src/utils/helpersUtils.js";
import { Purpose } from "../src/models/purposeModel.js";
import { PNDataCSVRow } from "../src/models/pnDataCsvRowModel.js";

describe("toCsvDataRow", () => {
  it("should return the correct data row (Active)", () => {
    const purpose: Purpose = {
      id: unsafeBrandId("id"),
      consumerId: unsafeBrandId("tenantId"),
      versions: [
        {
          state: "Active",
          firstActivationAt: new Date("2021-01-01"),
          dailyCalls: 200,
        },
      ],
      consumerName: "tenantName",
      consumerExternalId: {
        origin: "origin",
        value: "value",
      },
    };

    const expected: PNDataCSVRow = {
      nome_comune: "tenantName",
      stato_finalita_migliore: "Attivo",
      data_attivazione: new Date("2021-01-01"),
      fonte_codice: "origin",
      codice: "value",
      carico_finalita_migliore: 200,
    };

    expect(toCsvDataRow(purpose, genericLogger)).toEqual(expected);
  });

  it("should return the correct data row (Suspended)", () => {
    const purpose: Purpose = {
      id: unsafeBrandId("id"),
      consumerId: unsafeBrandId("tenantId"),
      versions: [
        {
          state: "Suspended",
          firstActivationAt: new Date("2021-01-01"),
          dailyCalls: 200,
        },
      ],
      consumerName: "tenantName",
      consumerExternalId: {
        origin: "origin",
        value: "value",
      },
    };
    const expected: PNDataCSVRow = {
      nome_comune: "tenantName",
      stato_finalita_migliore: "Sospeso",
      data_attivazione: new Date("2021-01-01"),
      fonte_codice: "origin",
      codice: "value",
      carico_finalita_migliore: 200,
    };

    expect(toCsvDataRow(purpose, genericLogger)).toEqual(expected);
  });

  it("should return the correct data row (WaitingForApproval)", () => {
    const purpose: Purpose = {
      id: unsafeBrandId("id"),
      consumerId: unsafeBrandId("tenantId"),
      versions: [
        {
          state: "WaitingForApproval",
          firstActivationAt: new Date("2021-01-01"),
          dailyCalls: 200,
        },
      ],
      consumerName: "tenantName",
      consumerExternalId: {
        origin: "origin",
        value: "value",
      },
    };
    const expected: PNDataCSVRow = {
      nome_comune: "tenantName",
      stato_finalita_migliore: "In attesa di attivazione",
      data_attivazione: new Date("2021-01-01"),
      fonte_codice: "origin",
      codice: "value",
      carico_finalita_migliore: 200,
    };

    expect(toCsvDataRow(purpose, genericLogger)).toEqual(expected);
  });

  it("should return the correct data row (WaitingForApproval) with firstActivationAt undefined", () => {
    const purpose: Purpose = {
      id: unsafeBrandId("id"),
      consumerId: unsafeBrandId("tenantId"),
      versions: [
        {
          state: "WaitingForApproval",
          firstActivationAt: undefined,
          dailyCalls: 200,
        },
      ],
      consumerName: "tenantName",
      consumerExternalId: {
        origin: "origin",
        value: "value",
      },
    };
    const expected: PNDataCSVRow = {
      nome_comune: "tenantName",
      stato_finalita_migliore: "In attesa di attivazione",
      data_attivazione: undefined,
      fonte_codice: "origin",
      codice: "value",
      carico_finalita_migliore: 200,
    };

    expect(toCsvDataRow(purpose, genericLogger)).toEqual(expected);
  });

  it("should throw an error if the purpose has no active, suspended or waiting for activation version", () => {
    const purpose: Purpose = {
      id: unsafeBrandId("id"),
      consumerId: unsafeBrandId("tenantId"),
      versions: [
        {
          state: "Archived",
          firstActivationAt: new Date("2021-01-01"),
          dailyCalls: 200,
        },
      ],
      consumerName: "tenantName",
      consumerExternalId: {
        origin: "origin",
        value: "value",
      },
    };

    expect(() => toCsvDataRow(purpose, genericLogger)).toThrow();
  });
});
