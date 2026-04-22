import crypto from "crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  EServiceId,
  generateId,
  makeProducerKeychainPlatformStatesPK,
  ProducerKeychain,
  ProducerKeychainDeletedV2,
  ProducerKeychainEServiceAddedV2,
  ProducerKeychainEServiceRemovedV2,
  ProducerKeychainId,
  ProducerKeychainKeyAddedV2,
  ProducerKeychainKeyDeletedV2,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  buildProducerKeychainPlatformStatesTable,
  deleteProducerKeychainPlatformStatesTable,
  dynamoDBClient,
  readAllProducerKeychainPlatformStatesEntries,
  readProducerKeychainPlatformStateEntry,
  tableName,
  writeProducerKeychainPlatformStateEntry,
} from "./utils.js";

describe("producer-keychain-platformstate-writer integration V2", () => {
  const key = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;
  const base64Key = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  const fixedDate = new Date("2026-03-03T10:00:00.000Z");

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await buildProducerKeychainPlatformStatesTable();
  });

  afterEach(async () => {
    await deleteProducerKeychainPlatformStatesTable();
  });

  it("ProducerKeychainKeyAdded should upsert keys x eservices", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const mockKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [mockKey],
      eservices: [eServiceId],
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 1,
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
      data: {
        producerKeychain: toProducerKeychainV2(mockProducerKeychain),
        kid: mockKey.kid,
      } as ProducerKeychainKeyAddedV2,
      log_date: new Date(),
    };

    await handleMessageV2(message, dynamoDBClient, tableName, genericLogger);

    const pk = makeProducerKeychainPlatformStatesPK({
      producerKeychainId,
      kid: mockKey.kid,
      eServiceId,
    });

    const entry = await readProducerKeychainPlatformStateEntry(pk);

    expect(entry).toBeDefined();
    expect(entry?.PK).toBe(pk);
    expect(entry?.producerKeychainId).toBe(producerKeychainId);
    expect(entry?.kid).toBe(mockKey.kid);
    expect(entry?.eServiceId).toBe(eServiceId);
    expect(entry?.publicKey).toBe(base64Key);
    expect(entry?.version).toBe(1);
  });

  it("ProducerKeychainEServiceAdded should upsert only entries for added eservice", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const existingEServiceId: EServiceId = generateId();
    const addedEServiceId: EServiceId = generateId();
    const mockKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [mockKey],
      eservices: [existingEServiceId, addedEServiceId],
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 2,
      type: "ProducerKeychainEServiceAdded",
      event_version: 2,
      data: {
        producerKeychain: toProducerKeychainV2(mockProducerKeychain),
        eserviceId: addedEServiceId,
      } as ProducerKeychainEServiceAddedV2,
      log_date: new Date(),
    };

    await handleMessageV2(message, dynamoDBClient, tableName, genericLogger);

    const addedPk = makeProducerKeychainPlatformStatesPK({
      producerKeychainId,
      kid: mockKey.kid,
      eServiceId: addedEServiceId,
    });

    const existingPk = makeProducerKeychainPlatformStatesPK({
      producerKeychainId,
      kid: mockKey.kid,
      eServiceId: existingEServiceId,
    });

    const addedEntry = await readProducerKeychainPlatformStateEntry(addedPk);
    const existingEntry =
      await readProducerKeychainPlatformStateEntry(existingPk);

    expect(addedEntry).toBeDefined();
    expect(existingEntry).toBeUndefined();
  });

  it("ProducerKeychainKeyDeleted should delete removed kid entries", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const removedKid = "removed-kid";
    const retainedKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };

    const removedPk = makeProducerKeychainPlatformStatesPK({
      producerKeychainId,
      kid: removedKid,
      eServiceId,
    });

    await writeProducerKeychainPlatformStateEntry({
      PK: removedPk,
      producerKeychainId,
      kid: removedKid,
      eServiceId,
      publicKey: base64Key,
      version: 1,
      updatedAt: new Date().toISOString(),
    });

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [retainedKey],
      eservices: [eServiceId],
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 3,
      type: "ProducerKeychainKeyDeleted",
      event_version: 2,
      data: {
        producerKeychain: toProducerKeychainV2(mockProducerKeychain),
        kid: removedKid,
      } as ProducerKeychainKeyDeletedV2,
      log_date: new Date(),
    };

    await handleMessageV2(message, dynamoDBClient, tableName, genericLogger);

    const removedEntry =
      await readProducerKeychainPlatformStateEntry(removedPk);
    expect(removedEntry).toBeUndefined();
  });

  it("ProducerKeychainEServiceRemoved should delete removed eservice entries", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const removedEServiceId: EServiceId = generateId();
    const retainedEServiceId: EServiceId = generateId();
    const keyEntry = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };

    const removedPk = makeProducerKeychainPlatformStatesPK({
      producerKeychainId,
      kid: keyEntry.kid,
      eServiceId: removedEServiceId,
    });

    await writeProducerKeychainPlatformStateEntry({
      PK: removedPk,
      producerKeychainId,
      kid: keyEntry.kid,
      eServiceId: removedEServiceId,
      publicKey: base64Key,
      version: 1,
      updatedAt: new Date().toISOString(),
    });

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [keyEntry],
      eservices: [retainedEServiceId],
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 4,
      type: "ProducerKeychainEServiceRemoved",
      event_version: 2,
      data: {
        producerKeychain: toProducerKeychainV2(mockProducerKeychain),
        eserviceId: removedEServiceId,
      } as ProducerKeychainEServiceRemovedV2,
      log_date: new Date(),
    };

    await handleMessageV2(message, dynamoDBClient, tableName, genericLogger);

    const removedEntry =
      await readProducerKeychainPlatformStateEntry(removedPk);
    expect(removedEntry).toBeUndefined();
  });

  it("ProducerKeychainDeleted should delete all keychain entries", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const keyEntry = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };

    const pk = makeProducerKeychainPlatformStatesPK({
      producerKeychainId,
      kid: keyEntry.kid,
      eServiceId,
    });

    await writeProducerKeychainPlatformStateEntry({
      PK: pk,
      producerKeychainId,
      kid: keyEntry.kid,
      eServiceId,
      publicKey: base64Key,
      version: 1,
      updatedAt: new Date().toISOString(),
    });

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [keyEntry],
      eservices: [eServiceId],
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 5,
      type: "ProducerKeychainDeleted",
      event_version: 2,
      data: {
        producerKeychainId,
        producerKeychain: toProducerKeychainV2(mockProducerKeychain),
      } as ProducerKeychainDeletedV2,
      log_date: new Date(),
    };

    await handleMessageV2(message, dynamoDBClient, tableName, genericLogger);

    const allEntries = await readAllProducerKeychainPlatformStatesEntries();
    expect(allEntries).toHaveLength(0);
  });
});
