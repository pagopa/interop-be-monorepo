import { genericLogger } from "pagopa-interop-commons";
import {
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockProducerKeychain } from "pagopa-interop-commons-test";
import { producerKeychainNotFound } from "../src/model/domain/errors.js";
import { addOneProducerKeychain, authorizationService } from "./utils.js";

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

    const { producerKeychain } =
      await authorizationService.getProducerKeychainById({
        producerKeychainId: expectedProducerKeychain.id,
        organizationId,
        logger: genericLogger,
      });
    expect(producerKeychain).toEqual(expectedProducerKeychain);
  });
  it("should get from the readModel the producer keychain with the specified Id without users", async () => {
    const expectedProducerKeychainWithoutUser: ProducerKeychain = {
      ...getMockProducerKeychain(),
      users: [],
      producerId: organizationId,
    };

    await addOneProducerKeychain(expectedProducerKeychainWithoutUser);

    const { producerKeychain } =
      await authorizationService.getProducerKeychainById({
        producerKeychainId: expectedProducerKeychainWithoutUser.id,
        organizationId,
        logger: genericLogger,
      });
    expect(producerKeychain).toEqual(expectedProducerKeychainWithoutUser);
  });
  it("should throw producerKeychainNotFound if the producerKeychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(getMockProducerKeychain());
    const producerKeychainId: ProducerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainById({
        producerKeychainId,
        organizationId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(producerKeychainId));
  });
});
