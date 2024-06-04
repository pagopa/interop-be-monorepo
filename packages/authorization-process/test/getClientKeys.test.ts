import {
  getMockClient,
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
    await addOneClient(mockClient);

    const keys = await authorizationService.getClientKeys({
      clientId: mockClient.id,
      userIds: [],
      organizationId: unsafeBrandId(consumerId),
      logger: genericLogger,
    });
    expect(keys).toEqual([mockKey]);
  });
  it("should get the keys in the specified client with specific userIds", async () => {
    const keyUserId: UserId = generateId();
    const userId: UserId = generateId();

    const keyWithUser: Key = {
      ...mockKey,
      userId: keyUserId,
    };
    const clientWithKeyUser: Client = {
      ...mockClient,
      keys: [keyWithUser],
      users: [userId, keyUserId],
    };
    await addOneClient(clientWithKeyUser);

    const keys = await authorizationService.getClientKeys({
      clientId: clientWithKeyUser.id,
      userIds: [keyUserId],
      organizationId: unsafeBrandId(consumerId),
      logger: genericLogger,
    });
    expect(keys).toEqual([keyWithUser]);
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(getMockClient());
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
