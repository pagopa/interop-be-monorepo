import { describe, expect, it } from "vitest";
import {
  Client,
  ClientAdminSetV2,
  ClientId,
  generateId,
  TenantId,
  toClientV2,
  UserId,
} from "pagopa-interop-models";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockClient,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  clientAdminAlreadyAssignedToUser,
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";

describe("addAdminToClient", () => {
  const mockClient: Client = getMockClient();
  const adminId: UserId = generateId<UserId>();

  it("should write on event-store when adding admin to a client", async () => {
    await addOneClient(mockClient);

    await authorizationService.addAdminToClient(
      {
        adminId,
        clientId: mockClient.id,
      },
      getMockContext({ authData: getMockAuthData(mockClient.consumerId) })
    );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientAdminSet",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientAdminSetV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      client: toClientV2({
        ...mockClient,
        adminId,
      }),
      adminId,
    });
  });
  it("should throw clientNotFound when client is not found", async () => {
    await addOneClient(mockClient);
    const notFoundClientId = generateId<ClientId>();

    await expect(
      authorizationService.addAdminToClient(
        {
          adminId,
          clientId: notFoundClientId,
        },
        getMockContext({ authData: getMockAuthData(mockClient.consumerId) })
      )
    ).rejects.toThrowError(clientNotFound(notFoundClientId));
  });
  it("should throw organizationNotAllowedOnClient when user is not allowed to perform operations on Client", async () => {
    await addOneClient(mockClient);
    const authData = getMockAuthData(generateId<TenantId>());

    await expect(
      authorizationService.addAdminToClient(
        {
          adminId,
          clientId: mockClient.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(authData.organizationId, mockClient.id)
    );
  });
  it("should throw clientAdminAlreadyAssignedToUser if adminId is already assigned to the client as admin", async () => {
    const mockClientWithAdmin: Client = {
      ...mockClient,
      adminId,
    };
    await addOneClient(mockClientWithAdmin);
    await expect(
      authorizationService.addAdminToClient(
        {
          adminId,
          clientId: mockClientWithAdmin.id,
        },
        getMockContext({
          authData: getMockAuthData(mockClientWithAdmin.consumerId),
        })
      )
    ).rejects.toThrowError(
      clientAdminAlreadyAssignedToUser(mockClientWithAdmin.id, adminId)
    );
  });
});
