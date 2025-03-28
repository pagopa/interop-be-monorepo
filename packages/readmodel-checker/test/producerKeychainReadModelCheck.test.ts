import { getMockProducerKeychain } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  generateId,
  ProducerKeychain,
  WithMetadata,
} from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOneProducerKeychain,
  producerKeychainReadModelServiceSQL,
  readModelService,
  readModelServiceSQL,
} from "./utils.js";

describe("Check producerKeychain readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const producerKeychain = getMockProducerKeychain();

    await addOneProducerKeychain({
      data: producerKeychain,
      metadata: { version: 1 },
    });

    const collectionProducerKeychains =
      await readModelService.getAllReadModelProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      collectionItems: collectionProducerKeychains,
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

    await producerKeychainReadModelServiceSQL.upsertProducerKeychain(
      producerKeychain.data,
      producerKeychain.metadata.version
    );

    const collectionProducerKeychains =
      await readModelService.getAllReadModelProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      collectionItems: collectionProducerKeychains,
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

    await producerKeychainReadModelServiceSQL.upsertProducerKeychain(
      producerKeychain2.data,
      producerKeychain2.metadata.version
    );

    const collectionProducerKeychains =
      await readModelService.getAllReadModelProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      collectionItems: collectionProducerKeychains,
      postgresItems: postgresProducerKeychains,
      schema: "producerKeychain",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const producerKeychain1: WithMetadata<ProducerKeychain> = {
      data: getMockProducerKeychain(),
      metadata: { version: 1 },
    };

    const producerKeychain2: WithMetadata<ProducerKeychain> = {
      data: getMockProducerKeychain(),
      metadata: { version: 1 },
    };

    await addOneProducerKeychain(producerKeychain1);

    await producerKeychainReadModelServiceSQL.upsertProducerKeychain(
      producerKeychain1.data,
      producerKeychain1.metadata.version
    );
    await producerKeychainReadModelServiceSQL.upsertProducerKeychain(
      producerKeychain2.data,
      producerKeychain2.metadata.version
    );

    const collectionProducerKeychains =
      await readModelService.getAllReadModelProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      collectionItems: collectionProducerKeychains,
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

    const producerKeychain1ForSQL: WithMetadata<ProducerKeychain> = {
      data: {
        ...producerKeychain1.data,
        eservices: [generateId()],
      },
      metadata: producerKeychain1.metadata,
    };

    await addOneProducerKeychain(producerKeychain1);

    await producerKeychainReadModelServiceSQL.upsertProducerKeychain(
      producerKeychain1ForSQL.data,
      producerKeychain1ForSQL.metadata.version
    );

    const collectionProducerKeychains =
      await readModelService.getAllReadModelProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      collectionItems: collectionProducerKeychains,
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

    const producerKeychain1ForSQL: WithMetadata<ProducerKeychain> = {
      data: producerKeychain1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneProducerKeychain(producerKeychain1);

    await producerKeychainReadModelServiceSQL.upsertProducerKeychain(
      producerKeychain1ForSQL.data,
      producerKeychain1ForSQL.metadata.version
    );

    const collectionProducerKeychains =
      await readModelService.getAllReadModelProducerKeychains();

    const postgresProducerKeychains =
      await readModelServiceSQL.getAllProducerKeychains();

    const res = compare({
      collectionItems: collectionProducerKeychains,
      postgresItems: postgresProducerKeychains,
      schema: "producerKeychain",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
