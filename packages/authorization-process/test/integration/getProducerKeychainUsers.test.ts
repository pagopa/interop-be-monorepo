import {
  getMockAuthData,
  getMockContext,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  tenantNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
} from "../integrationUtils.js";

describe("getProducerKeychainUsers", async () => {
  it("should get from the readModel the users in the specified producer keychain", async () => {
    const organizationId: TenantId = generateId();
    const userId1: UserId = generateId();
    const userId2: UserId = generateId();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      users: [userId1, userId2],
      producerId: organizationId,
    };

    await addOneProducerKeychain(mockProducerKeychain);

    const users = await authorizationService.getProducerKeychainUsers(
      {
        producerKeychainId: mockProducerKeychain.id,
      },
      getMockContext({ authData: getMockAuthData(organizationId) })
    );
    expect(users).toEqual(expect.arrayContaining([userId1, userId2]));
  });
  it("should throw producerKeychainNotFound if the producer keychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(getMockProducerKeychain());
    const producerKeychainId: ProducerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainUsers(
        {
          producerKeychainId,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(producerKeychainNotFound(producerKeychainId));
  });
  it("should throw tenantNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const mockProducerKeychain: ProducerKeychain = getMockProducerKeychain();
    await addOneProducerKeychain(mockProducerKeychain);
    const organizationIdNotMatchWithProducer: TenantId = generateId();
    await expect(
      authorizationService.getProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
        },
        getMockContext({
          authData: getMockAuthData(organizationIdNotMatchWithProducer),
        })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnProducerKeychain(
        organizationIdNotMatchWithProducer,
        mockProducerKeychain.id
      )
    );
  });
});
