/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  ProducerKeychain,
  ProducerKeychainUserDeletedV2,
  UserId,
  generateId,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import {
  producerKeychainNotFound,
  producerKeychainUserIdNotFound,
  tenantNotAllowedOnProducerKeychain,
} from "../../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
} from "../integrationUtils.js";

describe("remove producer keychain user", () => {
  it("should write on event-store for removing a user from a producer keychain", async () => {
    const mockProducer = getMockTenant();
    const userIdToRemove: UserId = generateId();
    const userIdToNotRemove: UserId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      users: [userIdToRemove, userIdToNotRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    const removeProducerKeychainUserResponse =
      await authorizationService.removeProducerKeychainUser(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      );

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainUserDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainUserDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      users: [userIdToNotRemove],
    };

    expect(writtenPayload).toEqual({
      userId: userIdToRemove,
      producerKeychain: toProducerKeychainV2(expectedProducerKeychain),
    });
    expect(removeProducerKeychainUserResponse).toEqual({
      data: expectedProducerKeychain,
      metadata: {
        version: 1,
      },
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const mockProducer = getMockTenant();
    const userIdToRemove: UserId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      users: [userIdToRemove],
    };

    await addOneProducerKeychain(getMockProducerKeychain());

    expect(
      authorizationService.removeProducerKeychainUser(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      )
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw producerKeychainUserIdNotFound if the user isn't related to that producer keychain", async () => {
    const mockProducer = getMockTenant();
    const notExistingUserId: UserId = generateId();
    const userIdToNotRemove: UserId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      users: [userIdToNotRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainUser(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIdToRemove: notExistingUserId,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      )
    ).rejects.toThrowError(
      producerKeychainUserIdNotFound(notExistingUserId, mockProducerKeychain.id)
    );
  });
  it("should throw tenantNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const mockProducer1 = getMockTenant();
    const mockProducer2 = getMockTenant();
    const userIdToRemove: UserId = generateId();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer1.id,
      users: [userIdToRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainUser(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockProducer2.id) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnProducerKeychain(
        mockProducer2.id,
        mockProducerKeychain.id
      )
    );
  });
});
