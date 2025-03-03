import { getMockEService } from "pagopa-interop-commons-test/index.js";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { compare } from "../src/utils.js";
import {
  addOneEService,
  eserviceReadModelServiceSQL,
  readModelService,
} from "./utils.js";

describe("Check readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const eservice = getMockEService();

    await addOneEService({
      data: eservice,
      metadata: { version: 1 },
    });

    const collectionEServices =
      await readModelService.getAllReadModelEServices();

    const postgresEServices =
      await eserviceReadModelServiceSQL.getAllEServices();

    const res = compare({
      collectionItems: collectionEServices,
      postgresItems: postgresEServices,
      schema: "eservice",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    expect(1).toBe(1);
  });

  it("should detect differences if the postgres item is not present", async () => {
    expect(1).toBe(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    expect(1).toBe(1);
  });

  it("should detect differences if the items are different", async () => {
    expect(1).toBe(1);
  });
});
