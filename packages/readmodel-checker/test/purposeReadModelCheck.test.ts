import { getMockPurpose } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { generateId, Purpose, WithMetadata } from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOnePurpose,
  purposeReadModelServiceSQL,
  readModelService,
} from "./utils.js";

describe("Check purpose readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const purpose = getMockPurpose();

    await addOnePurpose({
      data: purpose,
      metadata: { version: 1 },
    });

    const collectionPurposes = await readModelService.getAllReadModelPurposes();

    const postgresPurposes = await purposeReadModelServiceSQL.getAllPurposes();

    const res = compare({
      collectionItems: collectionPurposes,
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

    await purposeReadModelServiceSQL.upsertPurpose(purpose);

    const collectionPurposes = await readModelService.getAllReadModelPurposes();

    const postgresPurposes = await purposeReadModelServiceSQL.getAllPurposes();

    const res = compare({
      collectionItems: collectionPurposes,
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

    await purposeReadModelServiceSQL.upsertPurpose(purpose2);

    const collectionPurposes = await readModelService.getAllReadModelPurposes();

    const postgresPurposes = await purposeReadModelServiceSQL.getAllPurposes();

    const res = compare({
      collectionItems: collectionPurposes,
      postgresItems: postgresPurposes,
      schema: "purpose",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const purpose1: WithMetadata<Purpose> = {
      data: getMockPurpose(),
      metadata: { version: 1 },
    };

    const purpose2: WithMetadata<Purpose> = {
      data: getMockPurpose(),
      metadata: { version: 1 },
    };

    await addOnePurpose(purpose1);

    await purposeReadModelServiceSQL.upsertPurpose(purpose1);
    await purposeReadModelServiceSQL.upsertPurpose(purpose2);

    const collectionPurposes = await readModelService.getAllReadModelPurposes();

    const postgresPurposes = await purposeReadModelServiceSQL.getAllPurposes();

    const res = compare({
      collectionItems: collectionPurposes,
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

    const purpose1ForSQL: WithMetadata<Purpose> = {
      data: {
        ...purpose1.data,
        consumerId: generateId(),
      },
      metadata: purpose1.metadata,
    };

    await addOnePurpose(purpose1);

    await purposeReadModelServiceSQL.upsertPurpose(purpose1ForSQL);

    const collectionPurposes = await readModelService.getAllReadModelPurposes();

    const postgresPurposes = await purposeReadModelServiceSQL.getAllPurposes();

    const res = compare({
      collectionItems: collectionPurposes,
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

    const purpose1ForSQL: WithMetadata<Purpose> = {
      data: purpose1.data,
      metadata: {
        version: 3,
      },
    };

    await addOnePurpose(purpose1);

    await purposeReadModelServiceSQL.upsertPurpose(purpose1ForSQL);

    const collectionPurposes = await readModelService.getAllReadModelPurposes();

    const postgresPurposes = await purposeReadModelServiceSQL.getAllPurposes();

    const res = compare({
      collectionItems: collectionPurposes,
      postgresItems: postgresPurposes,
      schema: "purpose",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
