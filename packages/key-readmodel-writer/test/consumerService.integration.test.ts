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
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleMessageV2 } from "../src/keyConsumerServiceV2.js";
import { keys } from "./utils.js";

describe("Events V2", async () => {
  it("ClientKeyAdded", async () => {
    const mockKey = getMockKey();

    const mockClient: Client = {
      ...getMockClient(),
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
      "data.id": mockClient.id,
    });

    expect(retrievedKey?.data).toEqual(toReadModelKey(addedKey));
    expect(retrievedKey?.metadata).toEqual({
      version: 1,
    });
  });
  it("ClientKeyDeleted", async () => {
    const mockKey: Key = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [mockKey],
    };
    await writeInReadmodel(toReadModelKey(mockKey), keys);

    const updatedClient = {
      ...mockClient,
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
      "data.id": mockKey.kid,
    });

    expect(retrievedKey).toBeUndefined();
  });
});
