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

    const addedKey: Key = getMockKey();

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
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [mockKey],
    };
    await writeInReadmodel(toReadModelKey(mockKey), keys);

    const payload: KeyDeletedV1 = {
      clientId: mockClient.id,
      keyId: mockKey.kid,
      deactivationTimestamp: "",
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
});
