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
  tenantNotAllowedOnProducerKeychain,
} from "../../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
} from "../integrationUtils.js";

describe("getProducerKeychainKeys", async () => {
  const producerId = generateId<TenantId>();
  const mockKey = getMockKey();
  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    keys: [mockKey],
    producerId: unsafeBrandId(producerId),
  };

  it("should get the keys in the specified producer keychain", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const keyWithUser1: Key = {
      ...getMockKey(),
      name: "key 1",
      userId: keyUserId1,
    };
    const keyWithUser2: Key = {
      ...getMockKey(),
      name: "key 2",
      userId: keyUserId2,
    };
    const keyWithUser3: Key = {
      ...getMockKey(),
      name: "key 3",
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
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(keys).toEqual({
      results: [keyWithUser1, keyWithUser2, keyWithUser3],
      totalCount: 3,
    });
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
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(keys).toEqual({
      results: [keyWithUser1],
      totalCount: 1,
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(mockProducerKeychain);
    const producerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainKeys(
        {
          producerKeychainId: unsafeBrandId(producerKeychainId),
          userIds: [],
          offset: 0,
          limit: 50,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(
      producerKeychainNotFound(unsafeBrandId(producerKeychainId))
    );
  });
  it("should throw tenantNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    await addOneProducerKeychain(mockProducerKeychain);
    const organizationId = generateId<TenantId>();
    await expect(
      authorizationService.getProducerKeychainKeys(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: [],
          offset: 0,
          limit: 50,
        },
        getMockContext({ authData: getMockAuthData(organizationId) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnProducerKeychain(
        unsafeBrandId(organizationId),
        unsafeBrandId(mockProducerKeychain.id)
      )
    );
  });
  it("should get the keys in the specified producerKeychain with offset and limit", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();
    const keyUserId4: UserId = generateId();
    const keyUserId5: UserId = generateId();
    const keyUserId6: UserId = generateId();

    const keyWithUser1: Key = {
      ...getMockKey(),
      name: "key 1",
      userId: keyUserId1,
    };
    const keyWithUser2: Key = {
      ...getMockKey(),
      name: "key 2",
      userId: keyUserId2,
    };
    const keyWithUser3: Key = {
      ...getMockKey(),
      name: "key 3",
      userId: keyUserId3,
    };
    const keyWithUser4: Key = {
      ...getMockKey(),
      name: "key 4",
      userId: keyUserId4,
    };
    const keyWithUser5: Key = {
      ...getMockKey(),
      name: "key 5",
      userId: keyUserId5,
    };
    const keyWithUser6: Key = {
      ...getMockKey(),
      name: "key 6",
      userId: keyUserId6,
    };

    const producerKeychainWithKeyUser: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [
        keyWithUser1,
        keyWithUser2,
        keyWithUser3,
        keyWithUser4,
        keyWithUser5,
        keyWithUser6,
      ],
      users: [keyUserId1, keyUserId2, keyUserId3],
    };

    await addOneProducerKeychain(producerKeychainWithKeyUser);

    const keys = await authorizationService.getProducerKeychainKeys(
      {
        producerKeychainId: mockProducerKeychain.id,
        userIds: [keyUserId1, keyUserId2, keyUserId3, keyUserId4, keyUserId5],
        offset: 2,
        limit: 1,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(keys).toEqual({
      results: [keyWithUser3],
      totalCount: 5,
    });
  });
});
