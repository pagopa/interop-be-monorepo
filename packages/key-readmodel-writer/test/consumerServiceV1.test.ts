import {
  getMockClient,
  getMockKey,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Key,
  Client,
  toReadModelKey,
  KeysAddedV1,
  toKeyV1,
  generateId,
  AuthorizationEventEnvelopeV1,
  KeyDeletedV1,
  unsafeBrandId,
  KeyRelationshipToUserMigratedV1,
  UserId,
  ClientId,
  ClientDeletedV1,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleMessageV1 } from "../src/keyConsumerServiceV1.js";
import { keys } from "./utils.js";

describe("Events V1", async () => {
  it("KeysAdded", async () => {
    const mockKey = getMockKey();

    const mockClient: Client = {
      ...getMockClient(),
      keys: [],
    };
    await writeInReadmodel(toReadModelKey(mockKey), keys);

    const addedKey: Key = { ...getMockKey(), clientId: mockClient.id };

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

    expect(retrievedKey?.data).toEqual(toReadModelKey(addedKey));
    expect(retrievedKey?.metadata).toEqual({
      version: 1,
    });
  });
  it("KeyDeleted", async () => {
    const clientId: ClientId = generateId();
    const mockKey = { ...getMockKey(), clientId };
    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey],
    };
    await writeInReadmodel(toReadModelKey(mockKey), keys);

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
  it("KeyRelationshipToUserMigrated", async () => {
    const clientId: ClientId = generateId();
    const mockKey: Key = {
      ...getMockKey(),
      userId: unsafeBrandId(""),
      clientId,
    };
    const mockClient: Client = {
      ...getMockClient(),
      id: clientId,
      keys: [mockKey],
    };
    await writeInReadmodel(toReadModelKey(mockKey), keys);

    const userId: UserId = generateId();

    const payload: KeyRelationshipToUserMigratedV1 = {
      clientId: mockClient.id,
      keyId: mockKey.kid,
      userId,
    };

    const message: AuthorizationEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockClient.id,
      version: 1,
      type: "KeyRelationshipToUserMigrated",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, keys);

    const retrievedKey = await keys.findOne({
      "data.kid": mockKey.kid,
    });

    expect(retrievedKey?.data).toEqual(toReadModelKey({ ...mockKey, userId }));
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
