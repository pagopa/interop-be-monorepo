import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  makeProducerKeychainPlatformStatesPK,
  ProducerKeychain,
  ProducerKeychainId,
} from "pagopa-interop-models";
import {
  deleteAllProducerKeychainPlatformStatesEntries,
  deleteProducerKeychainPlatformStatesEntriesByEServiceId,
  deleteProducerKeychainPlatformStatesEntriesByKid,
  upsertAllProducerKeychainPlatformStatesEntries,
  upsertProducerKeychainPlatformStatesEntriesByKid,
  upsertProducerKeychainPlatformStatesEntriesByEServiceId,
} from "../src/utils.js";
import {
  buildProducerKeychainPlatformStatesTable,
  deleteProducerKeychainPlatformStatesTable,
  dynamoDBClient,
  readAllProducerKeychainPlatformStatesEntries,
  readProducerKeychainPlatformStateEntry,
  tableName,
  writeProducerKeychainPlatformStateEntry,
} from "./utils.js";

describe("utils tests", () => {
  beforeEach(async () => {
    await buildProducerKeychainPlatformStatesTable();
  });

  afterEach(async () => {
    await deleteProducerKeychainPlatformStatesTable();
  });

  it("upsertProducerKeychainPlatformStatesEntriesByEServiceId should write one entry per key", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const keys = [getMockKey(), getMockKey()];

    await upsertProducerKeychainPlatformStatesEntriesByEServiceId({
      producerKeychainId,
      eServiceId,
      keys,
      version: 1,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    const entries = await readAllProducerKeychainPlatformStatesEntries();

    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.eServiceId === eServiceId)).toBe(
      true
    );
  });

  it("upsertProducerKeychainPlatformStatesEntriesByKid should write one entry per eservice", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const key = { ...getMockKey(), producerKeychainId };
    const eServiceId1: EServiceId = generateId();
    const eServiceId2: EServiceId = generateId();

    await upsertProducerKeychainPlatformStatesEntriesByKid({
      producerKeychainId,
      kid: key.kid,
      keys: [key],
      eServiceIds: [eServiceId1, eServiceId2],
      version: 1,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    const entries = await readAllProducerKeychainPlatformStatesEntries();

    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.kid === key.kid)).toBe(true);
  });

  it("deleteProducerKeychainPlatformStatesEntriesByKid should delete entries for all provided eservices", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const kid = getMockKey().kid;
    const eServiceId1: EServiceId = generateId();
    const eServiceId2: EServiceId = generateId();

    const producerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [eServiceId1, eServiceId2],
      keys: [
        {
          ...getMockKey(),
          kid,
        },
      ],
    };

    await upsertAllProducerKeychainPlatformStatesEntries({
      producerKeychain,
      version: 1,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    await deleteProducerKeychainPlatformStatesEntriesByKid({
      producerKeychainId,
      kid,
      eServiceIds: [eServiceId1, eServiceId2],
      version: 2,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    const entries = await readAllProducerKeychainPlatformStatesEntries();
    expect(entries).toHaveLength(0);
  });

  it("deleteProducerKeychainPlatformStatesEntriesByEServiceId should delete entries for all provided kids", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const key1 = { ...getMockKey(), producerKeychainId };
    const key2 = getMockKey();

    const producerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [eServiceId],
      keys: [key1, key2],
    };

    await upsertAllProducerKeychainPlatformStatesEntries({
      producerKeychain,
      version: 1,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    await deleteProducerKeychainPlatformStatesEntriesByEServiceId({
      producerKeychainId,
      eServiceId,
      kids: [key1.kid, key2.kid],
      version: 2,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    const entries = await readAllProducerKeychainPlatformStatesEntries();
    expect(entries).toHaveLength(0);
  });

  it("deleteProducerKeychainPlatformStatesEntriesByEServiceId should not delete stale versions", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const kid = getMockKey().kid;
    const pk = makeProducerKeychainPlatformStatesPK({
      producerKeychainId,
      kid,
      eServiceId,
    });

    await writeProducerKeychainPlatformStateEntry({
      PK: pk,
      producerKeychainId,
      kid,
      eServiceId,
      publicKey: "current-key",
      version: 10,
      updatedAt: new Date().toISOString(),
    });

    await deleteProducerKeychainPlatformStatesEntriesByEServiceId({
      producerKeychainId,
      eServiceId,
      kids: [kid],
      version: 9,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    const entry = await readProducerKeychainPlatformStateEntry(pk);
    expect(entry).toBeDefined();
    expect(entry?.version).toBe(10);
  });

  it("deleteAllProducerKeychainPlatformStatesEntries should delete every keys x eservices entry", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId1: EServiceId = generateId();
    const eServiceId2: EServiceId = generateId();

    const producerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [eServiceId1, eServiceId2],
      keys: [getMockKey(), getMockKey()],
    };

    await upsertAllProducerKeychainPlatformStatesEntries({
      producerKeychain,
      version: 1,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    await deleteAllProducerKeychainPlatformStatesEntries({
      producerKeychain,
      version: 2,
      dynamoDBClient,
      tableName,
      logger: genericLogger,
    });

    const entries = await readAllProducerKeychainPlatformStatesEntries();
    expect(entries).toHaveLength(0);
  });
});
