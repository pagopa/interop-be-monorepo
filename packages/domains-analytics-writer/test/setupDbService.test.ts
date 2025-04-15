import { describe, expect, it, vi, afterAll } from "vitest";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import { config } from "../src/config/config.js";
import { AttributeDbtable, DeletingDbTable } from "../src/model/db.js";
import { setupStagingTablesError } from "../src/model/errors.js";
import { dbContext, getTablesByName } from "./utils.js";

describe("Setup DB Service tests for attribute tables", async () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  const attributeTables = [AttributeDbtable.attribute];

  const dbService = setupDbServiceBuilder(dbContext.conn, config);

  it("should create staging tables successfully for attribute tables", async () => {
    await dbService.setupStagingTables(attributeTables);

    const expectedTables = attributeTables.map(
      (t) => `${t}_${config.mergeTableSuffix}`
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
    ]);

    const result = await getTablesByName(dbContext.conn, [
      DeletingDbTable.attribute_deleting_table,
    ]);
    expect(result.length).toBe(1);
    expect(result[0].tablename).toBe(DeletingDbTable.attribute_deleting_table);
  });

  it("should throw an error if database query fails during staging tables creation", async () => {
    const mockQueryError = new Error("Simulated query failure");
    vi.spyOn(dbContext.conn, "query").mockRejectedValueOnce(mockQueryError);

    await expect(
      dbService.setupStagingTables(attributeTables)
    ).rejects.toThrowError(setupStagingTablesError(mockQueryError));
  });
});
