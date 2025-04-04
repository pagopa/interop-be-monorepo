import {
  getMockAuthData,
  getMockClient,
  getMockContext,
  getMockKey,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  Client,
  Key,
  UserId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { AuthData } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
  securityUserNotMember,
} from "../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "./utils.js";

describe("getClientKeys", async () => {
  const consumerId = generateId();
  const mockKey = getMockKey();
  const mockClient: Client = {
    ...getMockClient(),
    keys: [mockKey],
    consumerId: unsafeBrandId(consumerId),
  };
  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: unsafeBrandId(consumerId),
    userRoles: ["admin"],
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
    const clientWithKeyUser: Client = {
      ...mockClient,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneClient(clientWithKeyUser);

    const keys = await authorizationService.getClientKeys({
      clientId: mockClient.id,
      userIds: [keyUserId1, keyUserId2, keyUserId3],
      offset: 0,
      limit: 50,
      ctx: getMockContext({ authData }),
    });
    expect(keys).toEqual({
      results: [keyWithUser1, keyWithUser2, keyWithUser3],
      totalCount: 3,
    });
  });
  it("should get the keys of the specified client, but only limited to the keys belonging to specific users", async () => {
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
    const clientWithKeyUser: Client = {
      ...mockClient,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [userId, keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneClient(clientWithKeyUser);

    const keys = await authorizationService.getClientKeys({
      clientId: clientWithKeyUser.id,
      userIds: [keyUserId1],
      offset: 0,
      limit: 50,
      ctx: getMockContext({ authData }),
    });
    expect(keys).toEqual({
      results: [keyWithUser1],
      totalCount: 1,
    });
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(mockClient);
    const clientId = generateId();

    await expect(
      authorizationService.getClientKeys({
        clientId: unsafeBrandId(clientId),
        userIds: [],
        offset: 0,
        limit: 50,
        ctx: getMockContext({ authData }),
      })
    ).rejects.toThrowError(clientNotFound(unsafeBrandId(clientId)));
  });
  it("should throw securityUserNotMember if the requester has SECURITY_ROLE and the user is not a member of the organization", async () => {
    await addOneClient(mockClient);

    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: ["security"],
    };

    await expect(
      authorizationService.getClientKeys({
        clientId: unsafeBrandId(mockClient.id),
        userIds: [],
        offset: 0,
        limit: 50,
        ctx: getMockContext({ authData }),
      })
    ).rejects.toThrowError(
      securityUserNotMember(unsafeBrandId(authData.userId))
    );
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    await addOneClient(mockClient);
    const organizationId = generateId();

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: unsafeBrandId(organizationId),
    };

    await expect(
      authorizationService.getClientKeys({
        clientId: mockClient.id,
        userIds: [],
        offset: 0,
        limit: 50,
        ctx: getMockContext({ authData }),
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(
        unsafeBrandId(organizationId),
        unsafeBrandId(mockClient.id)
      )
    );
  });
  it("should get the keys in the specified client with offset and limit", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();
    const keyUserId4: UserId = generateId();
    const keyUserId5: UserId = generateId();
    const keyUserId6: UserId = generateId();

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
    const keyWithUser4: Key = {
      ...getMockKey(),
      userId: keyUserId4,
    };
    const keyWithUser5: Key = {
      ...getMockKey(),
      userId: keyUserId5,
    };
    const keyWithUser6: Key = {
      ...getMockKey(),
      userId: keyUserId6,
    };

    const clientWithKeyUser: Client = {
      ...mockClient,
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

    await addOneClient(clientWithKeyUser);

    const keys = await authorizationService.getClientKeys({
      clientId: mockClient.id,
      userIds: [keyUserId1, keyUserId2, keyUserId3, keyUserId4, keyUserId5],
      offset: 2,
      limit: 1,
      ctx: getMockContext({ authData }),
    });
    expect(keys).toEqual({
      results: [keyWithUser3],
      totalCount: 5,
    });
  });
});
