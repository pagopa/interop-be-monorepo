import {
  getMockClient,
  getMockKey,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Key,
  Client,
  ClientKeyAddedV2,
  toClientV2,
  AuthorizationEventEnvelopeV2,
  ClientKeyDeletedV2,
  toReadModelKey,
  ClientDeletedV2,
  ClientId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleMessageV2 } from "../src/keyConsumerServiceV2.js";
import { keys } from "./utils.js";

describe("Events V2", () => {
  it("ClientKeyAdded", async () => {
    const clientId: ClientId = generateId();
    const mockKey = { ...getMockKey(), clientId };

    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey],
    };
    await writeInReadmodel(toReadModelKey(mockKey), keys);

    const addedKey: Key = getMockKey();
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

    await handleMessageV2(message, keys);

    const retrievedKey = await keys.findOne({
      "data.kid": addedKey.kid,
    });

    expect(retrievedKey?.data).toEqual(toReadModelKey(addedKey));
    expect(retrievedKey?.metadata).toEqual({
      version: 1,
    });
  });
  it("ClientKeyDeleted", async () => {
    const clientId: ClientId = generateId();
    const mockKey: Key = { ...getMockKey(), clientId };
    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey],
    };
    await writeInReadmodel(toReadModelKey(mockKey), keys);

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

    await handleMessageV2(message, keys);

    const retrievedKey = await keys.findOne({
      "data.kid": mockKey.kid,
    });

    expect(retrievedKey).toBeNull();
  });
  it("ClientDeleted", async () => {
    const clientId: ClientId = generateId();
    const mockKey1: Key = { ...getMockKey(), clientId };
    const mockKey2: Key = { ...getMockKey(), clientId };
    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey1, mockKey2],
    };
    await writeInReadmodel(toReadModelKey(mockKey1), keys);
    await writeInReadmodel(toReadModelKey(mockKey2), keys);

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

    await handleMessageV2(message, keys);

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
