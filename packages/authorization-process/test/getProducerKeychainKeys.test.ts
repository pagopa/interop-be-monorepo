import {
  getMockAuthData,
  getMockContext,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  Key,
  ProducerKeychain,
  TenantId,
  UserId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  producerKeychainNotFound,
  organizationNotAllowedOnProducerKeychain,
} from "../src/model/domain/errors.js";
import { addOneProducerKeychain, authorizationService } from "./utils.js";

describe("getProducerKeychainKeys", async () => {
  const producerId = generateId<TenantId>();
  const mockKey = getMockKey();
  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    keys: [mockKey],
    producerId: unsafeBrandId(producerId),
  };

  it("should get the keys in the specified client", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const keyWithUser1: Key = {
      ...getMockKey(),
      userId: keyUserId1,
    };
    const keyWithUser2: Key = {
      ...getMockKey(),
      userId: keyUserId2,
    };
    const keyWithUser3: Key = {
      ...getMockKey(),
      userId: keyUserId3,
    };
    const producerKeychainWithKeyUser: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneProducerKeychain(producerKeychainWithKeyUser);

    const keys = await authorizationService.getProducerKeychainKeys(
      {
        producerKeychainId: mockProducerKeychain.id,
        userIds: [keyUserId1, keyUserId2, keyUserId3],
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(keys).toEqual([keyWithUser1, keyWithUser2, keyWithUser3]);
  });
  it("should get the keys of the specified producer keychain, but only limited to the keys belonging to specific users", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const userId: UserId = generateId();

    const keyWithUser1: Key = {
      ...getMockKey(),
      userId: keyUserId1,
    };
    const keyWithUser2: Key = {
      ...getMockKey(),
      userId: keyUserId2,
    };
    const keyWithUser3: Key = {
      ...getMockKey(),
      userId: keyUserId3,
    };
    const producerKeychainWithKeyUser: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [userId, keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneProducerKeychain(producerKeychainWithKeyUser);

    const keys = await authorizationService.getProducerKeychainKeys(
      {
        producerKeychainId: producerKeychainWithKeyUser.id,
        userIds: [keyUserId1],
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(keys).toEqual([keyWithUser1]);
  });
  it("should throw producerKeychainNotFound if the producer keychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(mockProducerKeychain);
    const producerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainKeys(
        {
          producerKeychainId: unsafeBrandId(producerKeychainId),
          userIds: [],
        },
        getMockContext({})
      )
    ).rejects.toThrowError(
      producerKeychainNotFound(unsafeBrandId(producerKeychainId))
    );
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    await addOneProducerKeychain(mockProducerKeychain);
    const organizationId = generateId<TenantId>();
    await expect(
      authorizationService.getProducerKeychainKeys(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: [],
        },
        getMockContext({ authData: getMockAuthData(organizationId) })
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        unsafeBrandId(organizationId),
        unsafeBrandId(mockProducerKeychain.id)
      )
    );
  });
});
