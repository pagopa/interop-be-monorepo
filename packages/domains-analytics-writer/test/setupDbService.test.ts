import { describe, expect, it, vi, afterAll } from "vitest";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import { dbContext, getTablesByName } from "./utils.js";
import { config } from "../src/config/config.js";

describe("Setup DB Service tests for catalog tables", () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  const catalogTables = [
    "eservice",
    "eservice_template_ref",
    "eservice_descriptor",
    "eservice_descriptor_template_version_ref",
    "eservice_descriptor_rejection_reason",
    "eservice_descriptor_interface",
    "eservice_descriptor_document",
    "eservice_descriptor_attribute",
    "eservice_risk_analysis",
    "eservice_risk_analysis_answer",
  ];

  const dbService = setupDbServiceBuilder(dbContext.conn, config);

  it("should create staging tables successfully for catalog tables", async () => {
    await dbService.setupStagingTables(catalogTables);

    const expectedTables = catalogTables.map(
      (t) => `${t}${config.mergeTableSuffix}`,
    );
    const result = await getTablesByName(dbContext.conn, expectedTables);

    expect(result.length).toBe(expectedTables.length);
    const createdTableNames = result.map((row) => row.tablename);
    expectedTables.forEach((table) => {
      expect(createdTableNames).toContain(table);
    });
  });

  it("should create staging deleting table successfully", async () => {
    await dbService.setupStagingDeletingByIdTables();

    const result = await getTablesByName(dbContext.conn, [
      "deleting_by_id_table",
    ]);
    expect(result.length).toBe(1);
    expect(result[0].tablename).toBe("deleting_by_id_table");
  });

  it("should throw an error if database query fails during staging tables creation", async () => {
    const mockQueryError = new Error("Simulated query failure");
    vi.spyOn(dbContext.conn, "query").mockRejectedValueOnce(mockQueryError);

    await expect(
      dbService.setupStagingTables(catalogTables),
    ).rejects.toThrowError(mockQueryError);
  });
});
