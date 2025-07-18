import crypto from "crypto";
import {
  getMockClient,
  getMockKey,
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
import {
  clientJWKKeyReadModelService,
  clientJWKKeyWriterService,
} from "./utils.js";

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

      await clientJWKKeyWriterService.upsertClientJWKKey(jwkKey, 1);

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

      await handleMessageV1(message, clientJWKKeyWriterService);

      const retrievedKey =
        await clientJWKKeyReadModelService.getClientJWKKeyByClientIdAndKid(
          mockClient.id,
          addedKey.kid
        );

      expect(retrievedKey?.data).toStrictEqual(
        keyToClientJWKKey(addedKey, mockClient.id)
      );
      expect(retrievedKey?.metadata).toStrictEqual({
        version: 1,
      });
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
    await clientJWKKeyWriterService.upsertClientJWKKey(jwkKey, 1);

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

    await handleMessageV1(message, clientJWKKeyWriterService);

    const retrievedKey =
      await clientJWKKeyReadModelService.getClientJWKKeyByClientIdAndKid(
        clientId,
        mockKey.kid
      );

    expect(retrievedKey).toBeUndefined();
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

    await clientJWKKeyWriterService.upsertClientJWKKey(jwkKey1, 1);
    await clientJWKKeyWriterService.upsertClientJWKKey(jwkKey2, 1);

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

    await handleMessageV1(message, clientJWKKeyWriterService);

    const retrievedKey1 =
      await clientJWKKeyReadModelService.getClientJWKKeyByClientIdAndKid(
        clientId,
        mockKey1.kid
      );
    const retrievedKey2 =
      await clientJWKKeyReadModelService.getClientJWKKeyByClientIdAndKid(
        clientId,
        mockKey2.kid
      );

    expect(retrievedKey1).toBeUndefined();
    expect(retrievedKey2).toBeUndefined();
  });
});
