import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test/index.js";
import {
  AuthorizationEventEnvelopeV2,
  UserId,
  generateId,
  ProducerKeychainAddedV2,
  toProducerKeychainV2,
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
import {
  producerKeychainReadModelService,
  producerKeychainWriterService,
} from "./utils.js";

describe("Events V2", async () => {
  const mockProducerKeychain = getMockProducerKeychain();
  const mockMessage: Omit<AuthorizationEventEnvelopeV2, "type" | "data"> = {
    event_version: 2,
    stream_id: mockProducerKeychain.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
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

    await handleMessageV2(message, producerKeychainWriterService);

    const retrievedProducerKeychain =
      await producerKeychainReadModelService.getProducerKeychainById(
        mockProducerKeychain.id
      );

    expect(retrievedProducerKeychain).toStrictEqual({
      data: mockProducerKeychain,
      metadata: { version: 1 },
    });
  });

  it("ProducerKeychainKeyAdded", async () => {
    await producerKeychainWriterService.upsertProducerKeychain(
      mockProducerKeychain,
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

    await handleMessageV2(message, producerKeychainWriterService);

    const retrievedProducerKeychain =
      await producerKeychainReadModelService.getProducerKeychainById(
        mockProducerKeychain.id
      );

    expect(retrievedProducerKeychain).toStrictEqual({
      data: updatedProducerKeychain,
      metadata: { version: 2 },
    });
  });

  it("ProducerKeychainKeyDeleted", async () => {
    const key: Key = getMockKey();
    const producerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [key],
    };
    await producerKeychainWriterService.upsertProducerKeychain(
      producerKeychain,
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

    await handleMessageV2(message, producerKeychainWriterService);

    const retrievedProducerKeychain =
      await producerKeychainReadModelService.getProducerKeychainById(
        producerKeychain.id
      );

    expect(retrievedProducerKeychain?.data.keys).toHaveLength(0);
  });

  it("ProducerKeychainUserAdded", async () => {
    await producerKeychainWriterService.upsertProducerKeychain(
      mockProducerKeychain,
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

    await handleMessageV2(message, producerKeychainWriterService);

    const retrievedProducerKeychain =
      await producerKeychainReadModelService.getProducerKeychainById(
        updatedProducerKeychain.id
      );

    expect(retrievedProducerKeychain).toStrictEqual({
      data: updatedProducerKeychain,
      metadata: { version: 2 },
    });
  });

  it("ProducerKeychainUserDeleted", async () => {
    const userId: UserId = generateId<UserId>();
    const producerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      users: [userId],
    };
    await producerKeychainWriterService.upsertProducerKeychain(
      producerKeychain,
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

    await handleMessageV2(message, producerKeychainWriterService);

    const retrievedProducerKeychain =
      await producerKeychainReadModelService.getProducerKeychainById(
        producerKeychain.id
      );

    expect(retrievedProducerKeychain?.data.users).toHaveLength(0);
  });

  it("ProducerKeychainEServiceAdded", async () => {
    await producerKeychainWriterService.upsertProducerKeychain(
      mockProducerKeychain,
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

    await handleMessageV2(message, producerKeychainWriterService);

    const retrievedProducerKeychain =
      await producerKeychainReadModelService.getProducerKeychainById(
        updatedProducerKeychain.id
      );

    expect(retrievedProducerKeychain).toStrictEqual({
      data: updatedProducerKeychain,
      metadata: { version: 2 },
    });
  });

  it("ProducerKeychainEServiceRemoved", async () => {
    const eserviceId: EServiceId = generateId<EServiceId>();
    const producerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      eservices: [eserviceId],
    };
    await producerKeychainWriterService.upsertProducerKeychain(
      producerKeychain,
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

    await handleMessageV2(message, producerKeychainWriterService);

    const retrievedProducerKeychain =
      await producerKeychainReadModelService.getProducerKeychainById(
        producerKeychain.id
      );

    expect(retrievedProducerKeychain?.data.eservices).toHaveLength(0);
  });
});
