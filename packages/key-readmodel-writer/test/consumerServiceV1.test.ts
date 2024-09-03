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
import { keyToClientJWKKey } from "pagopa-interop-commons";
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

  describe("KeysAdded", () => {
    it("KeysAdded - RSA", async () => {
      const mockClient: Client = {
        ...getMockClient(),
        keys: [],
      };
      const mockKey = { ...getMockKey(), encodedPem: base64Key };
      const jwkKey = keyToClientJWKKey(mockKey, mockClient.id);

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

      expect(retrievedKey?.data).toEqual(
        keyToClientJWKKey(addedKey, mockClient.id)
      );
      expect(retrievedKey?.metadata).toEqual({
        version: 1,
      });
    });
    it.each(["prime256v1", "secp256k1"])("KeysAdded - EC", async (curve) => {
      const key = crypto.generateKeyPairSync("ec", {
        namedCurve: curve,
      }).publicKey;

      const base64Key = Buffer.from(
        key.export({ type: "spki", format: "pem" })
      ).toString("base64url");

      const mockClient: Client = {
        ...getMockClient(),
        keys: [],
      };

      const addedKey: Key = {
        ...getMockKey(),
        encodedPem: base64Key,
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

      expect(retrievedKey).toBeNull();
    });
  });

  it("KeyDeleted", async () => {
    const clientId: ClientId = generateId();
    const mockKey = { ...getMockKey(), encodedPem: base64Key };
    const jwkKey = keyToClientJWKKey(mockKey, clientId);

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
    const jwkKey1 = keyToClientJWKKey(mockKey1, clientId);
    const jwkKey2 = keyToClientJWKKey(mockKey2, clientId);

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
