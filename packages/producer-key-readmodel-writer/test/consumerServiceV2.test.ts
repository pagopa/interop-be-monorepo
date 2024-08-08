import crypto from "crypto";
import {
  getMockKey,
  writeInReadmodel,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test/index.js";
import {
  AuthorizationEventEnvelopeV2,
  generateId,
  ProducerKeychainId,
  ProducerKeychain,
  Key,
  ProducerKeychainKeyAddedV2,
  toProducerKeychainV2,
  ProducerKeychainKeyDeletedV2,
  ProducerKeychainDeletedV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { keyToProducerJWKKey } from "pagopa-interop-commons";
import { handleMessageV2 } from "../src/producerKeyConsumerServiceV2.js";
import { producerKeys } from "./utils.js";

describe("Events V2", () => {
  const key = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;

  const base64Key = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  const key2 = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;

  const base64Key2 = Buffer.from(
    key2.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  it("ProducerKeychainKeyAdded", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const mockKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };
    const producerKeychainJWKKey = keyToProducerJWKKey(
      mockKey,
      producerKeychainId
    );

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [mockKey],
    };
    await writeInReadmodel(producerKeychainJWKKey, producerKeys);

    const addedKey: Key = {
      ...getMockKey(),
      encodedPem: base64Key2,
    };
    const updatedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [mockKey, addedKey],
    };

    const payload: ProducerKeychainKeyAddedV2 = {
      producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      kid: addedKey.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 1,
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV2(message, producerKeys);

    const retrievedKey = await producerKeys.findOne({
      "data.kid": addedKey.kid,
    });

    expect(retrievedKey?.data).toEqual(
      keyToProducerJWKKey(addedKey, producerKeychainId)
    );
    expect(retrievedKey?.metadata).toEqual({
      version: 1,
    });
  });
  it("ProducerKeychainKeyDeleted", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const mockKey: Key = {
      ...getMockKey(),
      encodedPem: base64Key,
    };
    const producerKeychainJWKKey = keyToProducerJWKKey(
      mockKey,
      producerKeychainId
    );
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [mockKey],
    };
    await writeInReadmodel(producerKeychainJWKKey, producerKeys);

    const updatedProducerKeychain = {
      ...mockProducerKeychain,
      producerKeys: [],
    };

    const payload: ProducerKeychainKeyDeletedV2 = {
      producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      kid: mockKey.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 1,
      type: "ProducerKeychainKeyDeleted",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV2(message, producerKeys);

    const retrievedKey = await producerKeys.findOne({
      "data.kid": mockKey.kid,
    });

    expect(retrievedKey).toBeNull();
  });
  it("ProducerKeychainDeleted", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const mockKey1: Key = {
      ...getMockKey(),
      encodedPem: base64Key,
    };
    const mockKey2: Key = {
      ...getMockKey(),
      encodedPem: base64Key2,
    };
    const producerKeychainJWKKey1 = keyToProducerJWKKey(
      mockKey1,
      producerKeychainId
    );
    const producerKeychainJWKKey2 = keyToProducerJWKKey(
      mockKey2,
      producerKeychainId
    );
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      keys: [mockKey1, mockKey2],
    };
    await writeInReadmodel(producerKeychainJWKKey1, producerKeys);
    await writeInReadmodel(producerKeychainJWKKey2, producerKeys);

    const payload: ProducerKeychainDeletedV2 = {
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
      producerKeychainId: mockProducerKeychain.id,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 1,
      type: "ProducerKeychainDeleted",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV2(message, producerKeys);

    const retrievedKey1 = await producerKeys.findOne({
      "data.kid": mockKey1.kid,
    });

    const retrievedKey2 = await producerKeys.findOne({
      "data.kid": mockKey2.kid,
    });

    expect(retrievedKey1).toBeNull();
    expect(retrievedKey2).toBeNull();
  });
});
