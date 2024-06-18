import { getMockClient } from "pagopa-interop-commons-test/src/testUtils.js";
import {
  Client,
  ClientId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "./utils.js";

describe("getClientUsers", async () => {
  const consumerId: TenantId = generateId();
  const userId1: UserId = generateId();
  const userId2: UserId = generateId();
  const mockClient: Client = {
    ...getMockClient(),
    users: [userId1, userId2],
    consumerId,
  };

  it("should get from the readModel the users in the specified client", async () => {
    await addOneClient(mockClient);

    const { users } = await authorizationService.getClientUsers(
      mockClient.id,
      consumerId,
      genericLogger
    );
    expect(users).toEqual([userId1, userId2]);
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(mockClient);
    const clientId: ClientId = generateId();
    await expect(
      authorizationService.getClientUsers(clientId, generateId(), genericLogger)
    ).rejects.toThrowError(clientNotFound(clientId));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    await addOneClient(mockClient);
    const organizationId: TenantId = generateId();
    await expect(
      authorizationService.getClientUsers(
        mockClient.id,
        organizationId,
        genericLogger
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(organizationId, mockClient.id)
    );
  });
});
