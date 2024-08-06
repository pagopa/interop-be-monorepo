import crypto from "crypto";
import {
  getMockClient,
  getMockKey,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Key,
  Client,
  KeysAddedV1,
  toKeyV1,
  generateId,
  AuthorizationEventEnvelopeV1,
  KeyDeletedV1,
  ClientId,
  ClientDeletedV1,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { keyToJWKKey } from "pagopa-interop-commons";
import { handleMessageV1 } from "../src/keyConsumerServiceV1.js";
import { keys } from "./utils.js";

describe("Events V1", async () => {
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

  it("KeysAdded", async () => {
    const mockClient: Client = {
      ...getMockClient(),
      keys: [],
    };
    const mockKey = { ...getMockKey(), encodedPem: base64Key };
    const jwkKey = keyToJWKKey(mockKey, mockClient.id);

    await writeInReadmodel(jwkKey, keys);

    const addedKey: Key = {
      ...getMockKey(),
      encodedPem: base64Key2,
    };

    const payload: KeysAddedV1 = {
      clientId: mockClient.id,
      keys: [
        {
          keyId: generateId(),
          value: toKeyV1(addedKey),
        },
      ],
    };

    const message: AuthorizationEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "KeysAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, keys);

    const retrievedKey = await keys.findOne({
      "data.kid": addedKey.kid,
    });

    expect(retrievedKey?.data).toEqual(keyToJWKKey(addedKey, mockClient.id));
    expect(retrievedKey?.metadata).toEqual({
      version: 1,
    });
  });
  it("KeyDeleted", async () => {
    const clientId: ClientId = generateId();
    const mockKey = { ...getMockKey(), encodedPem: base64Key };
    const jwkKey = keyToJWKKey(mockKey, clientId);

    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey],
    };
    await writeInReadmodel(jwkKey, keys);

    const payload: KeyDeletedV1 = {
      clientId: mockClient.id,
      keyId: mockKey.kid,
      deactivationTimestamp: new Date().toISOString(),
    };

    const message: AuthorizationEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "KeyDeleted",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, keys);

    const retrievedKey = await keys.findOne({
      "data.kid": mockKey.kid,
    });

    expect(retrievedKey).toBeNull();
  });
  it("ClientDeleted", async () => {
    const clientId: ClientId = generateId();
    const mockKey1: Key = { ...getMockKey(), encodedPem: base64Key };
    const mockKey2: Key = { ...getMockKey(), encodedPem: base64Key2 };
    const jwkKey1 = keyToJWKKey(mockKey1, clientId);
    const jwkKey2 = keyToJWKKey(mockKey2, clientId);

    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey1, mockKey2],
    };

    await writeInReadmodel(jwkKey1, keys);
    await writeInReadmodel(jwkKey2, keys);

    const payload: ClientDeletedV1 = {
      clientId: mockClient.id,
    };

    const message: AuthorizationEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientDeleted",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, keys);

    const retrievedKey1 = await keys.findOne({
      "data.kid": mockKey1.kid,
    });
    const retrievedKey2 = await keys.findOne({
      "data.kid": mockKey2.kid,
    });

    expect(retrievedKey1).toBeNull();
    expect(retrievedKey2).toBeNull();
  });
});
