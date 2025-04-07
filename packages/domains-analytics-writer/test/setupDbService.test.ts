import { describe, expect, it, vi, afterAll, inject } from "vitest";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import { config } from "../src/config/config.js";
import { AttributeDbtable, DeletingDbTable } from "../src/model/db.js";
import { dbContext, getTablesByName } from "./utils.js";

describe("Setup DB Service tests for catalog tables", async () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  const catalogTables = [AttributeDbtable.attribute];

  const dbService = setupDbServiceBuilder(dbContext.conn, config);

  it("should create staging tables successfully for attribute tables", async () => {
    await dbService.setupStagingTables(catalogTables);

    const expectedTables = catalogTables.map(
      (t) => `${t}${config.mergeTableSuffix}`
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
      DeletingDbTable.deleting_by_id_table,
    ]);
    expect(result.length).toBe(1);
    expect(result[0].tablename).toBe(DeletingDbTable.deleting_by_id_table);
  });

  it("should throw an error if database query fails during staging tables creation", async () => {
    const mockQueryError = new Error("Simulated query failure");
    vi.spyOn(dbContext.conn, "query").mockRejectedValueOnce(mockQueryError);

    await expect(
      dbService.setupStagingTables(catalogTables)
    ).rejects.toThrowError(mockQueryError);
  });
});
