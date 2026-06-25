import {
  EServiceId,
  ProducerKeychain,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  getMockAuthData,
  getMockContext,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import {
  addOneProducerKeychain,
  authorizationService,
} from "../integrationUtils.js";

describe("getProducerKeychainEServiceFlags", async () => {
  const producerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const requesterId = generateId<TenantId>();

  const mockProducerKeychain = (
    eservices: EServiceId[],
    keys: ProducerKeychain["keys"] = []
  ): ProducerKeychain => ({
    ...getMockProducerKeychain({ producerId }),
    eservices,
    keys,
  });

  it("should return false flags when no producer keychain is linked to the eservice", async () => {
    await addOneProducerKeychain(mockProducerKeychain([]));

    const result = await authorizationService.getProducerKeychainEServiceFlags(
      {
        producerId,
        eserviceId,
      },
      getMockContext({ authData: getMockAuthData(requesterId) })
    );

    expect(result).toEqual({
      hasProducerKeychain: false,
      hasProducerKeychainKeys: false,
    });
  });

  it("should distinguish a linked producer keychain without keys", async () => {
    await addOneProducerKeychain(mockProducerKeychain([eserviceId]));

    const result = await authorizationService.getProducerKeychainEServiceFlags(
      {
        producerId,
        eserviceId,
      },
      getMockContext({ authData: getMockAuthData(requesterId) })
    );

    expect(result).toEqual({
      hasProducerKeychain: true,
      hasProducerKeychainKeys: false,
    });
  });

  it("should return true flags when a linked producer keychain has keys", async () => {
    await addOneProducerKeychain(
      mockProducerKeychain([eserviceId], [getMockKey()])
    );

    const result = await authorizationService.getProducerKeychainEServiceFlags(
      {
        producerId,
        eserviceId,
      },
      getMockContext({ authData: getMockAuthData(requesterId) })
    );

    expect(result).toEqual({
      hasProducerKeychain: true,
      hasProducerKeychainKeys: true,
    });
  });
});
