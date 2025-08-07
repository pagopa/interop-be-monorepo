import crypto from "crypto";
import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import {
  Key,
  Client,
  ClientKeyAddedV2,
  toClientV2,
  AuthorizationEventEnvelopeV2,
  ClientKeyDeletedV2,
  ClientDeletedV2,
  ClientId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { keyToClientJWKKey } from "pagopa-interop-commons";
import { handleMessageV2 } from "../src/keyConsumerServiceV2.js";
import {
  clientJWKKeyReadModelService,
  clientJWKKeyWriterService,
} from "./utils.js";

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

  it("ClientKeyAdded", async () => {
    const clientId: ClientId = generateId();
    const mockKey = { ...getMockKey(), encodedPem: base64Key };
    const jwkKey = keyToClientJWKKey(mockKey, clientId);

    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey],
    };
    await clientJWKKeyWriterService.upsertClientJWKKey(jwkKey, 1);

    const addedKey: Key = { ...getMockKey(), encodedPem: base64Key2 };
    const updatedClient: Client = {
      ...mockClient,
      keys: [mockKey, addedKey],
    };

    const payload: ClientKeyAddedV2 = {
      client: toClientV2(updatedClient),
      kid: addedKey.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientKeyAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV2(message, clientJWKKeyWriterService);

    const retrievedKey =
      await clientJWKKeyReadModelService.getClientJWKKeyByClientIdAndKid(
        clientId,
        addedKey.kid
      );

    expect(retrievedKey?.data).toStrictEqual(
      keyToClientJWKKey(addedKey, clientId)
    );
    expect(retrievedKey?.metadata).toStrictEqual({
      version: 1,
    });
  });
  it("ClientKeyDeleted", async () => {
    const clientId: ClientId = generateId();
    const mockKey: Key = { ...getMockKey(), encodedPem: base64Key };
    const jwkKey = keyToClientJWKKey(mockKey, clientId);
    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey],
    };
    await clientJWKKeyWriterService.upsertClientJWKKey(jwkKey, 1);

    const updatedClient = {
      ...mockClient,
      keys: [],
    };

    const payload: ClientKeyDeletedV2 = {
      client: toClientV2(updatedClient),
      kid: mockKey.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientKeyDeleted",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV2(message, clientJWKKeyWriterService);

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

    const payload: ClientDeletedV2 = {
      client: toClientV2(mockClient),
      clientId: mockClient.id,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "ClientDeleted",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV2(message, clientJWKKeyWriterService);

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
