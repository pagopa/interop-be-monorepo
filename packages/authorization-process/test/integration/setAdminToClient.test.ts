import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Client,
  ClientAdminSetV2,
  ClientId,
  clientKind,
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
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import {
  clientAdminAlreadyAssignedToUser,
  clientKindNotAllowed,
  clientNotFound,
  tenantNotAllowedOnClient,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
  selfcareV2Client,
} from "../integrationUtils.js";

function mockSelfcareV2ClientCall(
  value: Awaited<
    ReturnType<typeof selfcareV2Client.getInstitutionUsersByProductUsingGET>
  >
): void {
  selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
    async () => value
  );
}

const mockSelfCareUsers: selfcareV2ClientApi.UserResource = {
  id: generateId(),
  name: "test",
  roles: [],
  email: "test@test.it",
  surname: "surname_test",
};

describe("setAdminToClient", () => {
  const mockClient: Client = { ...getMockClient(), kind: clientKind.api };
  const adminId: UserId = generateId<UserId>();

  beforeEach(() => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
  });

  it("should write on event-store when adding admin to a client", async () => {
    await addOneClient(mockClient);

    const setAdminReturn = await authorizationService.setAdminToClient(
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

    const expectedClient = {
      ...mockClient,
      adminId,
    };
    expect(writtenPayload).toEqual({
      client: toClientV2(expectedClient),
      adminId,
      oldAdminId: mockClient.adminId,
    });
    expect(setAdminReturn).toEqual(expectedClient);
  });
  it("should throw clientNotFound when client is not found", async () => {
    await addOneClient(mockClient);
    const notFoundClientId = generateId<ClientId>();

    await expect(
      authorizationService.setAdminToClient(
        {
          adminId,
          clientId: notFoundClientId,
        },
        getMockContext({ authData: getMockAuthData(mockClient.consumerId) })
      )
    ).rejects.toThrowError(clientNotFound(notFoundClientId));
  });
  it("should throw tenantNotAllowedOnClient when user is not allowed to perform operations on Client", async () => {
    await addOneClient(mockClient);
    const authData = getMockAuthData(generateId<TenantId>());

    await expect(
      authorizationService.setAdminToClient(
        {
          adminId,
          clientId: mockClient.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnClient(authData.organizationId, mockClient.id)
    );
  });
  it("should throw clientKindNotAllowed when client kind is not allowed", async () => {
    const client: Client = getMockClient();
    await addOneClient(client);
    const authData = getMockAuthData(generateId<TenantId>());

    await expect(
      authorizationService.setAdminToClient(
        {
          adminId,
          clientId: client.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(clientKindNotAllowed(client.id));
  });
  it("should throw userWithoutSecurityPrivileges when users length is 0", async () => {
    mockSelfcareV2ClientCall([]);
    const authData = getMockAuthData(generateId<TenantId>());
    await addOneClient(mockClient);

    await expect(
      authorizationService.setAdminToClient(
        {
          adminId,
          clientId: mockClient.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(authData.organizationId, authData.userId)
    );
  });
  it("should throw userAlreadyAssignedAsAdmin if adminId is already assigned to the client as admin", async () => {
    const mockClientWithAdmin: Client = {
      ...mockClient,
      adminId,
    };
    await addOneClient(mockClientWithAdmin);
    await expect(
      authorizationService.setAdminToClient(
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
