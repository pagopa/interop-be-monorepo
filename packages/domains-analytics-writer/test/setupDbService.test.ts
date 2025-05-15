import { describe, expect, it, vi, afterAll } from "vitest";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import { config } from "../src/config/config.js";
import {
  AgreementDbTable,
  AttributeDbTable,
  CatalogDbTable,
  DeletingDbTable,
  PurposeDbTable,
} from "../src/model/db.js";
import { setupStagingTablesError } from "../src/model/errors.js";
import { dbContext, getTablesByName } from "./utils.js";

describe("Setup DB Service tests for attribute tables", async () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });
  const attributeTables = [AttributeDbTable.attribute];

  const agreementTables = [
    AgreementDbTable.agreement,
    AgreementDbTable.agreement_consumer_document,
    AgreementDbTable.agreement_contract,
    AgreementDbTable.agreement_stamp,
  ];

  const catalogTables = [
    CatalogDbTable.eservice,
    CatalogDbTable.eservice_descriptor,
    CatalogDbTable.eservice_descriptor_attribute,
    CatalogDbTable.eservice_descriptor_document,
    CatalogDbTable.eservice_descriptor_interface,
    CatalogDbTable.eservice_descriptor_rejection_reason,
    CatalogDbTable.eservice_descriptor_template_version_ref,
    CatalogDbTable.eservice_risk_analysis,
    CatalogDbTable.eservice_risk_analysis_answer,
  ];

  const purposeTables = [
    PurposeDbTable.purpose,
    PurposeDbTable.purpose_version,
    PurposeDbTable.purpose_version_document,
    PurposeDbTable.purpose_risk_analysis_form,
    PurposeDbTable.purpose_risk_analysis_answer,
  ];

  const stagingTables = [
    ...attributeTables,
    ...catalogTables,
    ...agreementTables,
    ...purposeTables,
  ];

  const dbService = setupDbServiceBuilder(dbContext.conn, config);

  it("should create staging tables successfully", async () => {
    await dbService.setupStagingTables(attributeTables);

    const expectedTables = attributeTables.map(
      (t) => `${t}_${config.mergeTableSuffix}`,
    );
    const result = await getTablesByName(dbContext.conn, expectedTables);

    expect(result.length).toBe(expectedTables.length);
    const createdTableNames = result.map((row) => row.tablename);
    expectedTables.forEach((table) => {
      expect(createdTableNames).toContain(table);
    });
  });

  it("should create staging tables successfully for agreement tables", async () => {
    await dbService.setupStagingTables(agreementTables);

    const expectedTables = agreementTables.map(
      (t) => `${t}_${config.mergeTableSuffix}`,
    );
    const result = await getTablesByName(dbContext.conn, expectedTables);

    expect(result.length).toBe(expectedTables.length);
    const createdTableNames = result.map((row) => row.tablename);
    expectedTables.forEach((table) => {
      expect(createdTableNames).toContain(table);
    });
  });

  it("should create staging tables successfully for catalog tables", async () => {
    await dbService.setupStagingTables(catalogTables);

    const expectedTables = catalogTables.map(
      (t) => `${t}_${config.mergeTableSuffix}`,
    );
    const result = await getTablesByName(dbContext.conn, expectedTables);

    expect(result.length).toBe(expectedTables.length);
    const createdTableNames = result.map((row) => row.tablename);
    expectedTables.forEach((table) => {
      expect(createdTableNames).toContain(table);
    });
  });

  it("should create staging deleting table successfully", async () => {
    await dbService.setupStagingDeletingByIdTables([
      DeletingDbTable.attribute_deleting_table,
      DeletingDbTable.catalog_deleting_table,
      DeletingDbTable.agreement_deleting_table,
      DeletingDbTable.purpose_deleting_table,
    ]);

    const result = await getTablesByName(dbContext.conn, [
      DeletingDbTable.attribute_deleting_table,
      DeletingDbTable.catalog_deleting_table,
      DeletingDbTable.agreement_deleting_table,
      DeletingDbTable.purpose_deleting_table,
    ]);
    expect(result.length).toBe(4);

    const tableNames = result.map((t) => t.tablename);
    expect(tableNames).toStrictEqual(
      [
        DeletingDbTable.attribute_deleting_table,
        DeletingDbTable.catalog_deleting_table,
        DeletingDbTable.agreement_deleting_table,
        DeletingDbTable.purpose_deleting_table,
      ].sort(),
    );
  });

  it("should throw an error if database query fails during staging tables creation", async () => {
    const mockQueryError = new Error("Simulated query failure");
    vi.spyOn(dbContext.conn, "query").mockRejectedValueOnce(mockQueryError);

    await expect(
      dbService.setupStagingTables(stagingTables),
    ).rejects.toThrowError(setupStagingTablesError(mockQueryError));
  });
});
