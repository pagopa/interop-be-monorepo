/* eslint-disable @typescript-eslint/no-floating-promises */

import {
  decodeProtobufPayload,
  getMockProducerKeychain,
  getMockAuthData,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  ProducerKeychain,
  ProducerKeychainUserAddedV2,
  TenantId,
  UserId,
  generateId,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthData } from "pagopa-interop-commons";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import {
  userWithoutSecurityPrivileges,
  producerKeychainNotFound,
  producerKeychainUserAlreadyAssigned,
  tenantNotAllowedOnProducerKeychain,
} from "../../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
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

describe("addProducerKeychainUsers", () => {
  it("should write on event-store when adding multiple users to a producer keychain", async () => {
    const producerId: TenantId = generateId();
    const users: UserId[] = [generateId()];
    const userIdsToAdd: UserId[] = [generateId(), generateId()];

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users,
    };

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneProducerKeychain(mockProducerKeychain);

    await authorizationService.addProducerKeychainUsers(
      {
        producerKeychainId: mockProducerKeychain.id,
        userIds: userIdsToAdd,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "2",
      type: "ProducerKeychainUserAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainUserAddedV2,
      payload: writtenEvent.data,
    });

    const expectedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      users: [...users, ...userIdsToAdd],
    };

    expect(writtenPayload).toEqual({
      userId: userIdsToAdd.at(-1),
      producerKeychain: toProducerKeychainV2(expectedProducerKeychain),
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const userIdsToAdd: UserId[] = [generateId()];
    const producerId: TenantId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users: [],
    };

    await addOneProducerKeychain(getMockProducerKeychain());
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.addProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: userIdsToAdd,
        },
        getMockContext({ authData: getMockAuthData(producerId) })
      )
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw producerKeychainUserAlreadyAssigned if one of the users passed already exists in the producer keychain", async () => {
    const producerId: TenantId = generateId();
    const userIdAlreadyAssigned: UserId = generateId();

    const users: UserId[] = [generateId(), userIdAlreadyAssigned];

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.addProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: [userIdAlreadyAssigned],
        },
        getMockContext({ authData: getMockAuthData(producerId) })
      )
    ).rejects.toThrowError(
      producerKeychainUserAlreadyAssigned(
        mockProducerKeychain.id,
        userIdAlreadyAssigned
      )
    );
  });
  it("should throw tenantNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const userIdToAdd: UserId = generateId();
    const organizationId: TenantId = generateId();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: generateId(),
      users: [],
    };

    await addOneProducerKeychain(mockProducerKeychain);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.addProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: [userIdToAdd],
        },
        getMockContext({ authData: getMockAuthData(organizationId) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnProducerKeychain(
        organizationId,
        mockProducerKeychain.id
      )
    );
  });
  it("should throw userWithoutSecurityPrivileges if one of the Security users is not found", async () => {
    const producerId: TenantId = generateId();

    const authData: AuthData = getMockAuthData(producerId);

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users: [],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall([]);

    expect(
      authorizationService.addProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: [generateId()],
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(producerId, authData.userId)
    );
  });
});
