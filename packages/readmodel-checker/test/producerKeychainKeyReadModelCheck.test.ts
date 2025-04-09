import { getMockProducerJWKKey } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { ProducerJWKKey, WithMetadata } from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOneProducerJWKKey,
  producerKeychainKeyReadModelServiceSQL,
  readModelService,
  readModelServiceSQL,
} from "./utils.js";

describe("Check producerKeychain key readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const jwkKey = getMockProducerJWKKey();

    await addOneProducerJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys = await readModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const jwkKey = getMockProducerJWKKey();

    await addOneProducerJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey(
      jwkKey,
      1
    );

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys = await readModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const jwkKey = getMockProducerJWKKey();
    const jwkKey2 = getMockProducerJWKKey();

    await addOneProducerJWKKey({
      data: jwkKey,
      metadata: { version: 1 },
    });

    await addOneProducerJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey(
      jwkKey2,
      1
    );

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys = await readModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const jwkKey1 = getMockProducerJWKKey();
    const jwkKey2 = getMockProducerJWKKey();

    await addOneProducerJWKKey({
      data: jwkKey2,
      metadata: { version: 1 },
    });

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey(
      jwkKey1,
      1
    );
    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey(
      jwkKey2,
      1
    );

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys = await readModelServiceSQL.getAllProducerJWKKeys();

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
      data: getMockProducerJWKKey(),
      metadata: { version: 1 },
    };

    const producerKeychainKey1ForSQL: WithMetadata<ProducerJWKKey> = {
      data: { ...producerKeychainKey1.data, alg: "wrong-alg" },
      metadata: producerKeychainKey1.metadata,
    };

    await addOneProducerJWKKey(producerKeychainKey1);

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey(
      producerKeychainKey1ForSQL.data,
      producerKeychainKey1ForSQL.metadata.version
    );

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys = await readModelServiceSQL.getAllProducerJWKKeys();

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
      data: getMockProducerJWKKey(),
      metadata: { version: 1 },
    };

    const producerKeychainKey1ForSQL: WithMetadata<ProducerJWKKey> = {
      data: producerKeychainKey1.data,
      metadata: { version: 3 },
    };

    await addOneProducerJWKKey(producerKeychainKey1);

    await producerKeychainKeyReadModelServiceSQL.upsertProducerJWKKey(
      producerKeychainKey1ForSQL.data,
      producerKeychainKey1ForSQL.metadata.version
    );

    const collectionKeys =
      await readModelService.getAllReadModelProducerJWKKeys();

    const postgresKeys = await readModelServiceSQL.getAllProducerJWKKeys();

    const res = compare({
      collectionItems: collectionKeys,
      postgresItems: postgresKeys,
      schema: "producerKeychain keys",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});
