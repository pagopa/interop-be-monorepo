import {
  getMockKey,
  getMockProducerKeychain,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  AuthorizationEventEnvelopeV2,
  UserId,
  generateId,
  ProducerKeychainAddedV2,
  toProducerKeychainV2,
  toReadModelProducerKeychain,
  ProducerKeychain,
  ProducerKeychainKeyAddedV2,
  ProducerKeychainKeyDeletedV2,
  ProducerKeychainUserAddedV2,
  ProducerKeychainUserDeletedV2,
  EServiceId,
  ProducerKeychainEServiceAddedV2,
  ProducerKeychainEServiceRemovedV2,
  Key,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleMessageV2 } from "../src/producerKeychainConsumerServiceV2.js";
import { producerKeychains } from "./utils.js";

describe("Events V2", async () => {
  const mockProducerKeychain = getMockProducerKeychain();
  const mockMessage: AuthorizationEventEnvelopeV2 = {
    event_version: 2,
    stream_id: mockProducerKeychain.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
    type: "ProducerKeychainAdded",
    data: {},
  };

  it("ProducerKeychainAdded", async () => {
    const payload: ProducerKeychainAddedV2 = {
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerKeychainAdded",
      data: payload,
    };

    await handleMessageV2(message, producerKeychains);

    const retrievedProducerKeychain = await producerKeychains.findOne({
      "data.id": mockProducerKeychain.id,
    });

    expect(retrievedProducerKeychain?.data).toEqual(
      toReadModelProducerKeychain(mockProducerKeychain)
    );

    expect(retrievedProducerKeychain?.metadata).toEqual({
      version: 1,
    });
  });

  it("ProducerKeychainKeyAdded", async () => {
    await writeInReadmodel(
      toReadModelProducerKeychain(mockProducerKeychain),
      producerKeychains,
      1
    );

    const key: Key = getMockKey();
    const updatedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [key],
    };
    const payload: ProducerKeychainKeyAddedV2 = {
      producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      kid: key.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerKeychainKeyAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, producerKeychains);

    const retrievedProducerKeychain = await producerKeychains.findOne({
      "data.id": mockProducerKeychain.id,
    });

    expect(retrievedProducerKeychain?.data).toEqual(
      toReadModelProducerKeychain(updatedProducerKeychain)
    );
    expect(retrievedProducerKeychain?.metadata).toEqual({
      version: 2,
    });
  });

  it("ProducerKeychainKeyDeleted", async () => {
    const key: Key = getMockKey();
    const producerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [key],
    };
    await writeInReadmodel(
      toReadModelProducerKeychain(producerKeychain),
      producerKeychains,
      1
    );

    const updatedProducerKeychain = mockProducerKeychain;

    const payload: ProducerKeychainKeyDeletedV2 = {
      producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      kid: key.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerKeychainKeyDeleted",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, producerKeychains);

    const retrievedProducerKeychain = await producerKeychains.findOne({
      "data.id": producerKeychain.id,
    });

    expect(retrievedProducerKeychain?.data.keys).toHaveLength(0);
  });

  it("ProducerKeychainUserAdded", async () => {
    await writeInReadmodel(
      toReadModelProducerKeychain(mockProducerKeychain),
      producerKeychains,
      1
    );

    const userId: UserId = generateId<UserId>();
    const updatedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      users: [userId],
    };

    const payload: ProducerKeychainUserAddedV2 = {
      producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      userId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerKeychainUserAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, producerKeychains);

    const retrievedProducerKeychain = await producerKeychains.findOne({
      "data.id": updatedProducerKeychain.id,
    });

    expect(retrievedProducerKeychain?.data).toEqual(
      toReadModelProducerKeychain(updatedProducerKeychain)
    );
    expect(retrievedProducerKeychain?.metadata).toEqual({
      version: 2,
    });
  });

  it("ProducerKeychainUserDeleted", async () => {
    const userId: UserId = generateId<UserId>();
    const producerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      users: [userId],
    };
    await writeInReadmodel(
      toReadModelProducerKeychain(producerKeychain),
      producerKeychains,
      1
    );

    const updatedProducerKeychain = mockProducerKeychain;

    const payload: ProducerKeychainUserDeletedV2 = {
      producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      userId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerKeychainUserDeleted",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, producerKeychains);

    const retrievedProducerKeychain = await producerKeychains.findOne({
      "data.id": producerKeychain.id,
    });

    expect(retrievedProducerKeychain?.data.users).toHaveLength(0);
  });

  it("ProducerKeychainEServiceAdded", async () => {
    await writeInReadmodel(
      toReadModelProducerKeychain(mockProducerKeychain),
      producerKeychains,
      1
    );

    const eserviceId: EServiceId = generateId<EServiceId>();
    const updatedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      eservices: [eserviceId],
    };

    const payload: ProducerKeychainEServiceAddedV2 = {
      producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      eserviceId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerKeychainEServiceAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, producerKeychains);

    const retrievedProducerKeychain = await producerKeychains.findOne({
      "data.id": updatedProducerKeychain.id,
    });

    expect(retrievedProducerKeychain?.data).toEqual(
      toReadModelProducerKeychain(updatedProducerKeychain)
    );
    expect(retrievedProducerKeychain?.metadata).toEqual({
      version: 2,
    });
  });

  it("ProducerKeychainEServiceRemoved", async () => {
    const eserviceId: EServiceId = generateId<EServiceId>();
    const producerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      eservices: [eserviceId],
    };
    await writeInReadmodel(
      toReadModelProducerKeychain(producerKeychain),
      producerKeychains,
      1
    );

    const updatedProducerKeychain = mockProducerKeychain;

    const payload: ProducerKeychainEServiceRemovedV2 = {
      producerKeychain: toProducerKeychainV2(updatedProducerKeychain),
      eserviceId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerKeychainEServiceRemoved",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, producerKeychains);

    const retrievedProducerKeychain = await producerKeychains.findOne({
      "data.id": producerKeychain.id,
    });

    expect(retrievedProducerKeychain?.data.eservices).toHaveLength(0);
  });
});
