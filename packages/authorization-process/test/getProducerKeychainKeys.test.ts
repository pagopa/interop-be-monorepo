import {
  getMockProducerKeychainKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  ProducerKeychainKey,
  ProducerKeychain,
  UserId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  producerKeychainNotFound,
  organizationNotAllowedOnProducerKeychain,
} from "../src/model/domain/errors.js";
import { addOneProducerKeychain, authorizationService } from "./utils.js";

describe("getProducerKeychainKeys", async () => {
  const producerId = generateId();
  const mockKey = getMockProducerKeychainKey();
  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    keys: [mockKey],
    producerId: unsafeBrandId(producerId),
  };

  it("should get the keys in the specified client", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const keyWithUser1: ProducerKeychainKey = {
      ...mockKey,
      userId: keyUserId1,
    };
    const keyWithUser2: ProducerKeychainKey = {
      ...mockKey,
      userId: keyUserId2,
    };
    const keyWithUser3: ProducerKeychainKey = {
      ...mockKey,
      userId: keyUserId3,
    };
    const producerKeychainWithKeyUser: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneProducerKeychain(producerKeychainWithKeyUser);

    const keys = await authorizationService.getProducerKeychainKeys({
      producerKeychainId: mockProducerKeychain.id,
      userIds: [keyUserId1, keyUserId2, keyUserId3],
      organizationId: unsafeBrandId(producerId),
      logger: genericLogger,
    });
    expect(keys).toEqual([keyWithUser1, keyWithUser2, keyWithUser3]);
  });
  it("should get the keys of the specified producer keychain, but only limited to the keys belonging to specific users", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const userId: UserId = generateId();

    const keyWithUser1: ProducerKeychainKey = {
      ...mockKey,
      userId: keyUserId1,
    };
    const keyWithUser2: ProducerKeychainKey = {
      ...mockKey,
      userId: keyUserId2,
    };
    const keyWithUser3: ProducerKeychainKey = {
      ...mockKey,
      userId: keyUserId3,
    };
    const producerKeychainWithKeyUser: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [userId, keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneProducerKeychain(producerKeychainWithKeyUser);

    const keys = await authorizationService.getProducerKeychainKeys({
      producerKeychainId: producerKeychainWithKeyUser.id,
      userIds: [keyUserId1],
      organizationId: unsafeBrandId(producerId),
      logger: genericLogger,
    });
    expect(keys).toEqual([keyWithUser1]);
  });
  it("should throw producerKeychainNotFound if the producer keychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(mockProducerKeychain);
    const producerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainKeys({
        producerKeychainId: unsafeBrandId(producerKeychainId),
        userIds: [],
        organizationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      producerKeychainNotFound(unsafeBrandId(producerKeychainId))
    );
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the consumer", async () => {
    await addOneProducerKeychain(mockProducerKeychain);
    const organizationId = generateId();
    await expect(
      authorizationService.getProducerKeychainKeys({
        producerKeychainId: mockProducerKeychain.id,
        userIds: [],
        organizationId: unsafeBrandId(organizationId),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        unsafeBrandId(organizationId),
        unsafeBrandId(mockProducerKeychain.id)
      )
    );
  });
});
