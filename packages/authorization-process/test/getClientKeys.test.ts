import {
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  Client,
  ClientKey,
  UserId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
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

  it("should get the keys in the specified client", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const keyWithUser1: ClientKey = {
      ...mockKey,
      userId: keyUserId1,
    };
    const keyWithUser2: ClientKey = {
      ...mockKey,
      userId: keyUserId2,
    };
    const keyWithUser3: ClientKey = {
      ...mockKey,
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
      organizationId: unsafeBrandId(consumerId),
      logger: genericLogger,
    });
    expect(keys).toEqual([keyWithUser1, keyWithUser2, keyWithUser3]);
  });
  it("should get the keys of the specified client, but only limited to the keys belonging to specific users", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const userId: UserId = generateId();

    const keyWithUser1: ClientKey = {
      ...mockKey,
      userId: keyUserId1,
    };
    const keyWithUser2: ClientKey = {
      ...mockKey,
      userId: keyUserId2,
    };
    const keyWithUser3: ClientKey = {
      ...mockKey,
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
      organizationId: unsafeBrandId(consumerId),
      logger: genericLogger,
    });
    expect(keys).toEqual([keyWithUser1]);
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(mockClient);
    const clientId = generateId();
    await expect(
      authorizationService.getClientKeys({
        clientId: unsafeBrandId(clientId),
        userIds: [],
        organizationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(unsafeBrandId(clientId)));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    await addOneClient(mockClient);
    const organizationId = generateId();
    await expect(
      authorizationService.getClientKeys({
        clientId: mockClient.id,
        userIds: [],
        organizationId: unsafeBrandId(organizationId),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(
        unsafeBrandId(organizationId),
        unsafeBrandId(mockClient.id)
      )
    );
  });
});
