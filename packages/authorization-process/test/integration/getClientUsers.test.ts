import {
  getMockAuthData,
  getMockClient,
  getMockContext,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  Client,
  ClientId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  clientNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "../integrationUtils.js";

describe("getClientUsers", async () => {
  const organizationId: TenantId = generateId();
  const userId1: UserId = generateId();
  const userId2: UserId = generateId();
  const mockClient: Client = {
    ...getMockClient(),
    users: [userId1, userId2],
    consumerId: organizationId,
  };

  it("should get from the readModel the users in the specified client", async () => {
    await addOneClient(mockClient);

    const users = await authorizationService.getClientUsers(
      {
        clientId: mockClient.id,
      },
      getMockContext({ authData: getMockAuthData(organizationId) })
    );
    expect(users.sort()).toEqual([userId1, userId2].sort());
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(mockClient);
    const clientId: ClientId = generateId();
    await expect(
      authorizationService.getClientUsers(
        {
          clientId,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(clientNotFound(clientId));
  });
  it("should throw tenantNotAllowedOnClient if the requester is not the consumer", async () => {
    await addOneClient(mockClient);
    const organizationIdNotMatchWithConsumer: TenantId = generateId();
    await expect(
      authorizationService.getClientUsers(
        {
          clientId: mockClient.id,
        },
        getMockContext({
          authData: getMockAuthData(organizationIdNotMatchWithConsumer),
        })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnClient(
        organizationIdNotMatchWithConsumer,
        mockClient.id
      )
    );
  });
});
