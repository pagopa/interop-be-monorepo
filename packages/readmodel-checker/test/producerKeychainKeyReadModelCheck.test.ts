import { getMockKey } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger, keyToProducerJWKKey } from "pagopa-interop-commons";
import {
  ProducerKeychainId,
  ProducerJWKKey,
  WithMetadata,
  generateId,
} from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOneProducerJWKKey,
  producerKeychainKeyReadModelServiceSQL,
  readModelService,
} from "./utils.js";

describe("Check producerKeychain key readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const jwkKey = keyToProducerJWKKey(
      getMockKey(),
      generateId<ProducerKeychainId>()
    );

    await addOneProducerJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys =
      await producerKeychainKeyReadModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const jwkKey = keyToProducerJWKKey(
      getMockKey(),
      generateId<ProducerKeychainId>()
    );

    await addOneProducerJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys =
      await producerKeychainKeyReadModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const jwkKey = keyToProducerJWKKey(
      getMockKey(),
      generateId<ProducerKeychainId>()
    );

    const jwkKey2 = keyToProducerJWKKey(
      getMockKey(),
      generateId<ProducerKeychainId>()
    );

    await addOneProducerJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    await addOneProducerJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys =
      await producerKeychainKeyReadModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const jwkKey1 = keyToProducerJWKKey(
      getMockKey(),
      generateId<ProducerKeychainId>()
    );

    const jwkKey2 = keyToProducerJWKKey(
      getMockKey(),
      generateId<ProducerKeychainId>()
    );

    await addOneProducerJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    await addOneProducerJWKKey({
      data: jwkKey1,
      metadata: { version: 1 },
    });

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey({
      data: jwkKey1,
      metadata: { version: 1 },
    });
    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys =
      await producerKeychainKeyReadModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const producerKeychainKey1: WithMetadata<ProducerJWKKey> = {
      data: keyToProducerJWKKey(getMockKey(), generateId<ProducerKeychainId>()),
      metadata: { version: 1 },
    };

    const producerKeychainKey1ForSQL: WithMetadata<ProducerJWKKey> = {
      data: keyToProducerJWKKey(getMockKey(), generateId<ProducerKeychainId>()),
      metadata: producerKeychainKey1.metadata,
    };

    await addOneProducerJWKKey(producerKeychainKey1);

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey(
      producerKeychainKey1ForSQL
    );

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys =
      await producerKeychainKeyReadModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const producerKeychainKey1: WithMetadata<ProducerJWKKey> = {
      data: keyToProducerJWKKey(getMockKey(), generateId<ProducerKeychainId>()),
      metadata: { version: 1 },
    };

    const producerKeychainKey1ForSQL: WithMetadata<ProducerJWKKey> = {
      data: producerKeychainKey1.data,
      metadata: { version: 3 },
    };

    await addOneProducerJWKKey(producerKeychainKey1);

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey(
      producerKeychainKey1ForSQL
    );

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys =
      await producerKeychainKeyReadModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
