import { getMockPurpose } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { generateId, Purpose, WithMetadata } from "pagopa-interop-models";
import { upsertPurpose } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOnePurpose,
  readModelDB,
  readModelServiceKPI,
  readModelServiceSQL,
} from "./utils.js";

describe("Check purpose readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const purpose = getMockPurpose();

    await addOnePurpose({
      data: purpose,
      metadata: { version: 1 },
    });

    const purposes = await readModelServiceKPI.getAllPurposes();

    const postgresPurposes = await readModelServiceSQL.getAllPurposes();

    const res = compare({
      kpiItems: purposes,
      postgresItems: postgresPurposes,
      schema: "purpose",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const purpose: WithMetadata<Purpose> = {
      data: getMockPurpose(),
      metadata: { version: 1 },
    };

    await addOnePurpose(purpose);

    await upsertPurpose(readModelDB, purpose.data, purpose.metadata.version);

    const purposes = await readModelServiceKPI.getAllPurposes();

    const postgresPurposes = await readModelServiceSQL.getAllPurposes();

    const res = compare({
      kpiItems: purposes,
      postgresItems: postgresPurposes,
      schema: "purpose",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const purpose1: WithMetadata<Purpose> = {
      data: getMockPurpose(),
      metadata: { version: 1 },
    };

    const purpose2: WithMetadata<Purpose> = {
      data: getMockPurpose(),
      metadata: { version: 1 },
    };

    await addOnePurpose(purpose1);
    await addOnePurpose(purpose2);

    await upsertPurpose(readModelDB, purpose2.data, purpose2.metadata.version);

    const purposes = await readModelServiceKPI.getAllPurposes();

    const postgresPurposes = await readModelServiceSQL.getAllPurposes();

    const res = compare({
      kpiItems: purposes,
      postgresItems: postgresPurposes,
      schema: "purpose",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the kpi item is not present", async () => {
    const purpose1: WithMetadata<Purpose> = {
      data: getMockPurpose(),
      metadata: { version: 1 },
    };

    const purpose2: WithMetadata<Purpose> = {
      data: getMockPurpose(),
      metadata: { version: 1 },
    };

    await addOnePurpose(purpose1);

    await upsertPurpose(readModelDB, purpose1.data, purpose1.metadata.version);
    await upsertPurpose(readModelDB, purpose2.data, purpose2.metadata.version);

    const purposes = await readModelServiceKPI.getAllPurposes();

    const postgresPurposes = await readModelServiceSQL.getAllPurposes();

    const res = compare({
      kpiItems: purposes,
      postgresItems: postgresPurposes,
      schema: "purpose",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const purpose1: WithMetadata<Purpose> = {
      data: {
        ...getMockPurpose(),
      },
      metadata: { version: 1 },
    };

    const purpose1InPostgresDb: WithMetadata<Purpose> = {
      data: {
        ...purpose1.data,
        consumerId: generateId(),
      },
      metadata: purpose1.metadata,
    };

    await addOnePurpose(purpose1);

    await upsertPurpose(
      readModelDB,
      purpose1InPostgresDb.data,
      purpose1InPostgresDb.metadata.version
    );

    const purposes = await readModelServiceKPI.getAllPurposes();

    const postgresPurposes = await readModelServiceSQL.getAllPurposes();

    const res = compare({
      kpiItems: purposes,
      postgresItems: postgresPurposes,
      schema: "purpose",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const purpose1: WithMetadata<Purpose> = {
      data: getMockPurpose(),
      metadata: { version: 1 },
    };

    const purpose1InPostgresDb: WithMetadata<Purpose> = {
      data: purpose1.data,
      metadata: {
        version: 3,
      },
    };

    await addOnePurpose(purpose1);

    await upsertPurpose(
      readModelDB,
      purpose1InPostgresDb.data,
      purpose1InPostgresDb.metadata.version
    );

    const purposes = await readModelServiceKPI.getAllPurposes();

    const postgresPurposes = await readModelServiceSQL.getAllPurposes();

    const res = compare({
      kpiItems: purposes,
      postgresItems: postgresPurposes,
      schema: "purpose",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
