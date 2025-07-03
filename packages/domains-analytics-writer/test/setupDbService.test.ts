import { describe, expect, it, vi, afterAll } from "vitest";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import { config } from "../src/config/config.js";
import { DbTable } from "../src/model/db/index.js";
import { setupStagingTablesError } from "../src/model/errors.js";
import {
  dbContext,
  deletingTables,
  domainTables,
  getTablesByName,
  partialTables,
  setupStagingDeletingTables,
} from "./utils.js";

describe("Setup DB Service tests for domain tables", async () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  const tablesWithSuffix = (tables: DbTable[]): string[] =>
    tables.map((t) => `${t}_${config.mergeTableSuffix}`);

  const dbService = setupDbServiceBuilder(dbContext.conn, config);

  it("should create staging tables for all domains successfully", async () => {
    await dbService.setupStagingTables(domainTables);

    const expectedTables = tablesWithSuffix(domainTables);
    const result = await getTablesByName(dbContext.conn, expectedTables);

    expect(result.length).toBe(expectedTables.length);

    const createdTableNames = result.map((row) => row.tablename);
    expect(createdTableNames).toEqual(expect.arrayContaining(expectedTables));
  });

  it("should create partial staging tables successfully", async () => {
    await dbService.setupPartialStagingTables(partialTables);

    const expectedTables = tablesWithSuffix(partialTables);
    const result = await getTablesByName(dbContext.conn, expectedTables);

    expect(result.length).toBe(partialTables.length);

    const createdTableNames = result.map((row) => row.tablename);
    expect(createdTableNames).toEqual(expect.arrayContaining(expectedTables));
  });

  it("should create staging deleting tables successfully", async () => {
    await dbService.setupStagingDeletingTables(setupStagingDeletingTables);

    const expectedTables = tablesWithSuffix(deletingTables);
    const result = await getTablesByName(dbContext.conn, expectedTables);

    expect(result.length).toBe(setupStagingDeletingTables.length);

    const createdTableNames = result.map((row) => row.tablename);
    expect(createdTableNames).toEqual(expect.arrayContaining(expectedTables));
  });

  it("should throw an error if database query fails during staging tables creation", async () => {
    const mockQueryError = new Error("Simulated query failure");
    vi.spyOn(dbContext.conn, "query").mockRejectedValueOnce(mockQueryError);

    await expect(
      dbService.setupStagingTables(domainTables)
    ).rejects.toThrowError(setupStagingTablesError(mockQueryError));
  });
});
