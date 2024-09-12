/* eslint-disable @typescript-eslint/no-floating-promises */

import {
  decodeProtobufPayload,
  getMockProducerKeychain,
  getRandomAuthData,
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
import { AuthData, genericLogger } from "pagopa-interop-commons";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import {
  userWithoutSecurityPrivileges,
  producerKeychainNotFound,
  producerKeychainUserAlreadyAssigned,
  organizationNotAllowedOnProducerKeychain,
} from "../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
  selfcareV2Client,
} from "./utils.js";

function mockSelfcareV2ClientCall(
  value: Awaited<
    ReturnType<typeof selfcareV2Client.getInstitutionProductUsersUsingGET>
  >
): void {
  selfcareV2Client.getInstitutionProductUsersUsingGET = vi.fn(
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

describe("addProducerKeychainUser", () => {
  it("should write on event-store when adding a user to a producer keychain", async () => {
    const producerId: TenantId = generateId();
    const userIdToAdd: UserId = generateId();
    const userId: UserId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users: [userId],
    };

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneProducerKeychain(mockProducerKeychain);

    await authorizationService.addProducerKeychainUser(
      {
        producerKeychainId: mockProducerKeychain.id,
        userId: userIdToAdd,
        authData: getRandomAuthData(producerId),
      },
      generateId(),
      genericLogger
    );

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainUserAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainUserAddedV2,
      payload: writtenEvent.data,
    });

    const expectedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      users: [userId, userIdToAdd],
    };

    expect(writtenPayload).toEqual({
      userId: userIdToAdd,
      producerKeychain: toProducerKeychainV2(expectedProducerKeychain),
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const userIdToAdd: UserId = generateId();
    const producerId: TenantId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users: [],
    };

    await addOneProducerKeychain(getMockProducerKeychain());
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.addProducerKeychainUser(
        {
          producerKeychainId: mockProducerKeychain.id,
          userId: userIdToAdd,
          authData: getRandomAuthData(producerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw producerKeychainUserAlreadyAssigned if the user already exists in the producer keychain", async () => {
    const producerId: TenantId = generateId();
    const userId: UserId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users: [userId],
    };

    await addOneProducerKeychain(mockProducerKeychain);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.addProducerKeychainUser(
        {
          producerKeychainId: mockProducerKeychain.id,
          userId,
          authData: getRandomAuthData(producerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      producerKeychainUserAlreadyAssigned(mockProducerKeychain.id, userId)
    );
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
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
      authorizationService.addProducerKeychainUser(
        {
          producerKeychainId: mockProducerKeychain.id,
          userId: userIdToAdd,
          authData: getRandomAuthData(organizationId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        organizationId,
        mockProducerKeychain.id
      )
    );
  });
  it("should throw userWithoutSecurityPrivileges if the Security user is not found", async () => {
    const producerId: TenantId = generateId();

    const authData: AuthData = {
      userId: generateId(),
      selfcareId: generateId(),
      organizationId: producerId,
      userRoles: [],
      externalId: {
        value: "",
        origin: "",
      },
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users: [],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall([]);

    expect(
      authorizationService.addProducerKeychainUser(
        {
          producerKeychainId: mockProducerKeychain.id,
          userId: generateId(),
          authData,
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(producerId, authData.userId)
    );
  });
});
