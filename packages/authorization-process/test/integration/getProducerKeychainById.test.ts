import {
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockAuthData,
  getMockContext,
  getMockProducerKeychain,
  sortProducerKeychain,
} from "pagopa-interop-commons-test";
import { producerKeychainNotFound } from "../../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
} from "../integrationUtils.js";

describe("getProducerKeychainById", async () => {
  const organizationId: TenantId = generateId();

  it("should get from the readModel the producer keychain with the specified Id with users", async () => {
    const userId1: UserId = generateId();
    const userId2: UserId = generateId();

    const expectedProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: organizationId,
      users: [userId1, userId2],
    };
    await addOneProducerKeychain(expectedProducerKeychain);

    const producerKeychain = await authorizationService.getProducerKeychainById(
      {
        producerKeychainId: expectedProducerKeychain.id,
      },
      getMockContext({ authData: getMockAuthData(organizationId) })
    );
    expect(sortProducerKeychain(producerKeychain)).toEqual({
      data: sortProducerKeychain(expectedProducerKeychain),
      metadata: { version: 0 },
    });
  });
  it("should get from the readModel the producer keychain with the specified Id without users", async () => {
    const expectedProducerKeychainWithoutUser: ProducerKeychain = {
      ...getMockProducerKeychain(),
      users: [],
      producerId: organizationId,
    };

    await addOneProducerKeychain(expectedProducerKeychainWithoutUser);

    const producerKeychain = await authorizationService.getProducerKeychainById(
      {
        producerKeychainId: expectedProducerKeychainWithoutUser.id,
      },
      getMockContext({ authData: getMockAuthData(organizationId) })
    );

    expect(sortProducerKeychain(producerKeychain)).toEqual({
      data: sortProducerKeychain(expectedProducerKeychainWithoutUser),
      metadata: { version: 0 },
    });
  });
  it("should throw producerKeychainNotFound if the producerKeychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(getMockProducerKeychain());
    const producerKeychainId: ProducerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainById(
        {
          producerKeychainId,
        },
        getMockContext({ authData: getMockAuthData(organizationId) })
      )
    ).rejects.toThrowError(producerKeychainNotFound(producerKeychainId));
  });
});
