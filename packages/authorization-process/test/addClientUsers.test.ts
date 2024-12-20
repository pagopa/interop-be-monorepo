/* eslint-disable @typescript-eslint/no-floating-promises */

import {
  decodeProtobufPayload,
  getMockClient,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  Client,
  ClientUserAddedV2,
  TenantId,
  UserId,
  generateId,
  toClientV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthData, genericLogger } from "pagopa-interop-commons";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
  userWithoutSecurityPrivileges,
  clientUserAlreadyAssigned,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
  selfcareV2Client,
} from "./utils.js";

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

describe("addClientUsers", () => {
  it("should write on event-store when adding users to a client", async () => {
    const consumerId: TenantId = generateId();
    const userIds: UserId[] = [generateId()];
    const usersToAdd: UserId[] = [generateId(), generateId()];

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: userIds,
    };

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    await authorizationService.addClientUsers(
      {
        clientId: mockClient.id,
        userIds: usersToAdd,
        authData: getRandomAuthData(consumerId),
      },
      generateId(),
      genericLogger
    );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "2",
      type: "ClientUserAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientUserAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      userId: usersToAdd.at(-1),
      client: toClientV2({
        ...mockClient,
        users: [...userIds, ...usersToAdd],
      }),
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const userIdToAdd: UserId = generateId();
    const consumerId: TenantId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [],
    };

    await addOneClient(getMockClient());
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.addClientUsers(
        {
          clientId: mockClient.id,
          userIds: [userIdToAdd],
          authData: getRandomAuthData(consumerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw clientUserAlreadyAssigned if one of the passed users already exists in the client", async () => {
    const consumerId: TenantId = generateId();
    const alreadyInClientUserId: UserId = generateId();
    const userIdsToAdd: UserId[] = [
      generateId(),
      alreadyInClientUserId,
      generateId(),
    ];

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [alreadyInClientUserId],
    };

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.addClientUsers(
        {
          clientId: mockClient.id,
          userIds: userIdsToAdd,
          authData: getRandomAuthData(consumerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      clientUserAlreadyAssigned(mockClient.id, alreadyInClientUserId)
    );
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const userIdsToAdd: UserId[] = [generateId()];
    const organizationId: TenantId = generateId();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
      users: [],
    };

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.addClientUsers(
        {
          clientId: mockClient.id,
          userIds: userIdsToAdd,
          authData: getRandomAuthData(organizationId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(organizationId, mockClient.id)
    );
  });
  it("should throw userWithoutSecurityPrivileges if one of the Security user is not found", async () => {
    const consumerId: TenantId = generateId();

    const authData: AuthData = {
      userId: generateId(),
      selfcareId: generateId(),
      organizationId: consumerId,
      userRoles: [],
      externalId: {
        value: "",
        origin: "",
      },
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [],
    };

    await addOneClient(mockClient);

    mockSelfcareV2ClientCall([]);

    expect(
      authorizationService.addClientUsers(
        {
          clientId: mockClient.id,
          userIds: [generateId()],
          authData,
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(consumerId, authData.userId)
    );
  });
});
