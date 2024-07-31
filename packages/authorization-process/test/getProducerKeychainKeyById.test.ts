/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { ProducerKeychain, TenantId, generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockProducerKeychain,
  getMockProducerKeychainKey,
} from "pagopa-interop-commons-test";
import {
  producerKeychainNotFound,
  producerKeychainKeyNotFound,
  organizationNotAllowedOnProducerKeychain,
} from "../src/model/domain/errors.js";
import { addOneProducerKeychain, authorizationService } from "./utils.js";

describe("getProducerKeychainKeyById", async () => {
  it("should get the producer keychain key if it exists", async () => {
    const producerId: TenantId = generateId();
    const mockKey1 = getMockProducerKeychainKey();
    const mockKey2 = getMockProducerKeychainKey();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      keys: [mockKey1, mockKey2],
    };
    await addOneProducerKeychain(mockProducerKeychain);

    const retrievedKey = await authorizationService.getProducerKeychainKeyById({
      producerKeychainId: mockProducerKeychain.id,
      kid: mockKey1.kid,
      organizationId: producerId,
      logger: genericLogger,
    });
    expect(retrievedKey).toEqual(mockKey1);
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const organizationId: TenantId = generateId();
    const mockKey = getMockProducerKeychainKey();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: generateId(),
      keys: [mockKey],
    };
    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.getProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        kid: mockKey.kid,
        organizationId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        organizationId,
        mockProducerKeychain.id
      )
    );
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const producerId: TenantId = generateId();
    const mockKey = getMockProducerKeychainKey();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      keys: [mockKey],
    };

    expect(
      authorizationService.getProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        kid: mockKey.kid,
        organizationId: producerId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw producerKeychainKeyNotFound if the key doesn't exist", async () => {
    const producerId: TenantId = generateId();
    const mockKey = getMockProducerKeychainKey();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      keys: [getMockProducerKeychainKey()],
    };
    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.getProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        kid: mockKey.kid,
        organizationId: producerId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      producerKeychainKeyNotFound(mockKey.kid, mockProducerKeychain.id)
    );
  });
});
