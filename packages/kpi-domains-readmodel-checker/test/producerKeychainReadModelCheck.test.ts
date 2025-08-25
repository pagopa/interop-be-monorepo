import { getMockProducerKeychain } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  generateId,
  ProducerKeychain,
  WithMetadata,
} from "pagopa-interop-models";
import { upsertProducerKeychain } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOneProducerKeychain,
  readModelDB,
  readModelServiceKPI,
  readModelServiceSQL,
} from "./utils.js";

describe("Check producerKeychain readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const producerKeychain = getMockProducerKeychain();

    await addOneProducerKeychain({
      data: producerKeychain,
      metadata: { version: 1 },
    });

    const producerKeychains =
      await readModelServiceKPI.getAllProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      kpiItems: producerKeychains,
      postgresItems: postgresProducerKeychains,
      schema: "producerKeychain",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const producerKeychain: WithMetadata<ProducerKeychain> = {
      data: getMockProducerKeychain(),
      metadata: { version: 1 },
    };

    await addOneProducerKeychain(producerKeychain);

    await upsertProducerKeychain(
      readModelDB,
      producerKeychain.data,
      producerKeychain.metadata.version
    );

    const producerKeychains =
      await readModelServiceKPI.getAllProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      kpiItems: producerKeychains,
      postgresItems: postgresProducerKeychains,
      schema: "producerKeychain",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const producerKeychain1: WithMetadata<ProducerKeychain> = {
      data: getMockProducerKeychain(),
      metadata: { version: 1 },
    };

    const producerKeychain2: WithMetadata<ProducerKeychain> = {
      data: getMockProducerKeychain(),
      metadata: { version: 1 },
    };

    await addOneProducerKeychain(producerKeychain1);
    await addOneProducerKeychain(producerKeychain2);

    await upsertProducerKeychain(
      readModelDB,
      producerKeychain2.data,
      producerKeychain2.metadata.version
    );

    const producerKeychains =
      await readModelServiceKPI.getAllProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      kpiItems: producerKeychains,
      postgresItems: postgresProducerKeychains,
      schema: "producerKeychain",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the kpi item is not present", async () => {
    const producerKeychain1: WithMetadata<ProducerKeychain> = {
      data: getMockProducerKeychain(),
      metadata: { version: 1 },
    };

    const producerKeychain2: WithMetadata<ProducerKeychain> = {
      data: getMockProducerKeychain(),
      metadata: { version: 1 },
    };

    await addOneProducerKeychain(producerKeychain1);

    await upsertProducerKeychain(
      readModelDB,
      producerKeychain1.data,
      producerKeychain1.metadata.version
    );
    await upsertProducerKeychain(
      readModelDB,
      producerKeychain2.data,
      producerKeychain2.metadata.version
    );

    const producerKeychains =
      await readModelServiceKPI.getAllProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      kpiItems: producerKeychains,
      postgresItems: postgresProducerKeychains,
      schema: "producerKeychain",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const producerKeychain1: WithMetadata<ProducerKeychain> = {
      data: {
        ...getMockProducerKeychain(),
      },
      metadata: { version: 1 },
    };

    const producerKeychain1InPostgresDb: WithMetadata<ProducerKeychain> = {
      data: {
        ...producerKeychain1.data,
        eservices: [generateId()],
      },
      metadata: producerKeychain1.metadata,
    };

    await addOneProducerKeychain(producerKeychain1);

    await upsertProducerKeychain(
      readModelDB,
      producerKeychain1InPostgresDb.data,
      producerKeychain1InPostgresDb.metadata.version
    );

    const producerKeychains =
      await readModelServiceKPI.getAllProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      kpiItems: producerKeychains,
      postgresItems: postgresProducerKeychains,
      schema: "producerKeychain",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const producerKeychain1: WithMetadata<ProducerKeychain> = {
      data: getMockProducerKeychain(),
      metadata: { version: 1 },
    };

    const producerKeychain1InPostgresDb: WithMetadata<ProducerKeychain> = {
      data: producerKeychain1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneProducerKeychain(producerKeychain1);

    await upsertProducerKeychain(
      readModelDB,
      producerKeychain1InPostgresDb.data,
      producerKeychain1InPostgresDb.metadata.version
    );

    const producerKeychains =
      await readModelServiceKPI.getAllProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      kpiItems: producerKeychains,
      postgresItems: postgresProducerKeychains,
      schema: "producerKeychain",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
