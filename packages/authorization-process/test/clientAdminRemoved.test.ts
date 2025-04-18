/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import {
  getMockAuthData,
  getMockClient,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  Client,
  ClientId,
  clientKind,
  generateId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import {
  clientAdminIdNotFound,
  clientKindNotAllowed,
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";

describe("clientAdminRemoved", () => {
  it("should write on event-store for the remove of an admin in a client", async () => {
    const mockClient: Client = {
      ...getMockClient(),
      adminId: generateId<UserId>(),
      kind: clientKind.api,
    };

    await addOneClient(mockClient);

    await authorizationService.removeClientAdmin(
      { clientId: mockClient.id, adminId: mockClient.adminId! },
      getMockContext({ authData: getMockAuthData(mockClient.consumerId) })
    );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientAdminRemoved",
      event_version: 2,
    });
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const adminId: UserId = generateId();
    const organizationId: TenantId = generateId();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
      adminId,
    };
    await addOneClient(mockClient);
    await expect(
      authorizationService.removeClientAdmin(
        { clientId: mockClient.id, adminId },
        getMockContext({ authData: getMockAuthData(organizationId) })
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(organizationId, mockClient.id)
    );
  });
  it("should throw clientNotFound if the client does not exist", async () => {
    const clientId = generateId<ClientId>();

    await expect(
      authorizationService.removeClientAdmin(
        { clientId, adminId: generateId<UserId>() },
        getMockContext({})
      )
    ).rejects.toThrowError(clientNotFound(clientId));
  });
  it("should throw clientKindNotAllowed if the client is not of kind api", async () => {
    const mockClient: Client = {
      ...getMockClient(),
      kind: clientKind.consumer,
    };

    await addOneClient(mockClient);

    await expect(
      authorizationService.removeClientAdmin(
        { clientId: mockClient.id, adminId: generateId<UserId>() },
        getMockContext({ authData: getMockAuthData(mockClient.consumerId) })
      )
    ).rejects.toThrowError(clientKindNotAllowed(mockClient.id));
  });
  it("should throw clientAdminIdNotFound if the adminId is not found", async () => {
    const adminId = generateId<UserId>();

    const mockClient1: Client = {
      ...getMockClient(),
      kind: clientKind.api,
    };

    await addOneClient(mockClient1);

    await expect(
      authorizationService.removeClientAdmin(
        { clientId: mockClient1.id, adminId },
        getMockContext({ authData: getMockAuthData(mockClient1.consumerId) })
      )
    ).rejects.toThrowError(clientAdminIdNotFound(mockClient1.id, adminId));

    const mockClient2: Client = {
      ...getMockClient(),
      kind: clientKind.api,
      adminId: generateId<UserId>(),
    };

    await addOneClient(mockClient2);

    await expect(
      authorizationService.removeClientAdmin(
        { clientId: mockClient2.id, adminId },
        getMockContext({ authData: getMockAuthData(mockClient2.consumerId) })
      )
    ).rejects.toThrowError(clientAdminIdNotFound(mockClient2.id, adminId));
  });
});
