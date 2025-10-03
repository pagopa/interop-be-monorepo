import {
  EServiceId,
  ProducerKeychain,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMockProducerKeychain,
  getMockAuthData,
  getMockContext,
  sortProducerKeychain,
} from "pagopa-interop-commons-test";
import { userRole } from "pagopa-interop-commons";
import {
  addOneProducerKeychain,
  authorizationService,
  readModelService,
} from "../integrationUtils.js";
import { GetProducerKeychainsFilters } from "../../src/services/readModelServiceSQL.js";

describe("getProducerKeychains", async () => {
  const producerId: TenantId = generateId();

  const mockKeychain1: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "a test keychain 1",
    producerId,
  };
  const mockKeychain2: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "a test keychain 2",
    producerId,
  };

  const userId1: UserId = generateId();
  const userId2: UserId = generateId();
  const mockKeychain3: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test3",
    users: [userId1, userId2],
    producerId,
  };
  const userId3: UserId = generateId();
  const userId4: UserId = generateId();
  const eserviceId: EServiceId = generateId();
  const mockKeychain4: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test4",
    users: [userId3, userId4],
    eservices: [eserviceId],
    producerId,
  };

  const mockKeychain5: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test5",
    eservices: [eserviceId],
    producerId,
  };

  const mockKeychain6: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test6",
    producerId: generateId<TenantId>(),
    users: [userId1, userId2],
    eservices: [eserviceId],
  };

  beforeEach(async () => {
    await addOneProducerKeychain(mockKeychain1);
    await addOneProducerKeychain(mockKeychain2);
    await addOneProducerKeychain(mockKeychain3);
    await addOneProducerKeychain(mockKeychain4);
    await addOneProducerKeychain(mockKeychain5);
    await addOneProducerKeychain(mockKeychain6);
  });

  it("should get all keychains when no filters are set", async () => {
    const authData = getMockAuthData(producerId);
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: undefined,
          userIds: [],
          producerId: undefined,
          eserviceId: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );
    expect({
      ...result,
      results: result.results.map(sortProducerKeychain),
    }).toEqual({
      totalCount: 6,
      results: [
        mockKeychain1,
        mockKeychain2,
        mockKeychain3,
        mockKeychain4,
        mockKeychain5,
        mockKeychain6,
      ].map(sortProducerKeychain),
    });
  });

  it("should get the keychains if they exist (parameters: name)", async () => {
    const spyQuery = vi.spyOn(readModelService, "getProducerKeychains");
    const authData = getMockAuthData(producerId);

    const filters: GetProducerKeychainsFilters = {
      name: "test keychain",
      userIds: [],
      producerId: undefined,
      eserviceId: undefined,
    };
    const result = await authorizationService.getProducerKeychains(
      {
        filters,
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );

    expect(spyQuery).toHaveBeenCalledWith(
      {
        ...filters,
        producerId: authData.organizationId,
        // ^ Keychain name is visible only to keychain owner.
        // When name is set, the producerId filter is overridden with the caller tenant
        // so that only keychains owned by the caller are returned.
      },
      {
        offset: 0,
        limit: 50,
      }
    );

    expect({
      ...result,
      results: result.results.map(sortProducerKeychain),
    }).toEqual({
      totalCount: 2,
      results: [mockKeychain1, mockKeychain2].map(sortProducerKeychain),
    });
  });

  it("should get the keychains if they exist (parameters: userIds taken from the authData)", async () => {
    const spyQuery = vi.spyOn(readModelService, "getProducerKeychains");
    const authData = getMockAuthData(producerId, userId1, [
      userRole.SECURITY_ROLE,
    ]);

    const filters: GetProducerKeychainsFilters = {
      name: "",
      userIds: [],
      producerId: undefined,
      eserviceId: undefined,
    };

    const result = await authorizationService.getProducerKeychains(
      {
        filters,
        offset: 0,
        limit: 50,
      },
      getMockContext({
        authData,
      })
    );

    expect(spyQuery).toHaveBeenCalledWith(
      {
        ...filters,
        userIds: [authData.userId],
        // userIds taken from the filter is overridden with the one from authData
        // when caller has role "security"
      },
      {
        offset: 0,
        limit: 50,
      }
    );

    expect({
      ...result,
      results: result.results.map(sortProducerKeychain),
    }).toEqual({
      totalCount: 2,
      results: [mockKeychain3, mockKeychain6].map(sortProducerKeychain),
    });
  });

  it("should get the keychains if they exist (parameters: producerId, userIds taken from the filter)", async () => {
    const spyQuery = vi.spyOn(readModelService, "getProducerKeychains");
    const authData = getMockAuthData(producerId);
    const filters: GetProducerKeychainsFilters = {
      name: "",
      userIds: [userId1, userId3],
      producerId: undefined,
      eserviceId: undefined,
    };
    const result = await authorizationService.getProducerKeychains(
      {
        filters,
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );

    expect(spyQuery).toHaveBeenCalledWith(
      {
        ...filters,
        producerId: authData.organizationId,
        // Keychain users are visible only to keychain owner.
        // When userIds is set, the producerId filter is overridden with the caller tenant
        // so that only keychains owned by the caller are returned.
      },
      {
        offset: 0,
        limit: 50,
      }
    );

    expect({
      ...result,
      results: result.results.map(sortProducerKeychain),
    }).toEqual({
      totalCount: 2,
      results: [mockKeychain3, mockKeychain4].map(sortProducerKeychain),
    });
  });

  it("should get the keychains if they exist (parameters: producerId)", async () => {
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: undefined,
          userIds: [],
          producerId,
          eserviceId: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect({
      ...result,
      results: result.results.map(sortProducerKeychain),
    }).toEqual({
      totalCount: 5,
      results: [
        mockKeychain1,
        mockKeychain2,
        mockKeychain3,
        mockKeychain4,
        mockKeychain5,
      ].map(sortProducerKeychain),
    });
  });

  it("should get the keychains if they exist (parameters: eserviceId)", async () => {
    const spyQuery = vi.spyOn(readModelService, "getProducerKeychains");
    const authData = getMockAuthData(producerId);

    const filters: GetProducerKeychainsFilters = {
      name: undefined,
      userIds: [],
      producerId: undefined,
      eserviceId,
    };
    const result = await authorizationService.getProducerKeychains(
      {
        filters,
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );

    expect(spyQuery).toHaveBeenCalledWith(
      {
        ...filters,
        producerId: authData.organizationId,
        // Keychain e-services are visible only to keychain owner.
        // When eserviceId is set, the producerId filter is overridden with the caller tenant
        // so that only keychains owned by the caller are returned.
      },
      {
        offset: 0,
        limit: 50,
      }
    );

    expect({
      ...result,
      results: result.results.map(sortProducerKeychain),
    }).toEqual({
      totalCount: 2,
      results: [mockKeychain4, mockKeychain5].map(sortProducerKeychain),
    });
  });

  it("should get the keychains if they exist (pagination: offset)", async () => {
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: undefined,
          userIds: [],
          producerId,
          eserviceId: undefined,
        },
        offset: 2,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(result.results.map(sortProducerKeychain)).toEqual(
      [mockKeychain3, mockKeychain4, mockKeychain5].map(sortProducerKeychain)
    );
  });

  it("should get the keychains if they exist (pagination: limit)", async () => {
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: undefined,
          userIds: [],
          producerId,
          eserviceId: undefined,
        },
        offset: 0,
        limit: 2,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(result.results.map(sortProducerKeychain)).toEqual(
      [mockKeychain1, mockKeychain2].map(sortProducerKeychain)
    );
  });

  it("should not get the keychains if they don't exist", async () => {
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: undefined,
          userIds: [],
          producerId: generateId<TenantId>(),
          eserviceId: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(result).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should get the keychains if they exist (parameters: name, userIds, producerId, eserviceId)", async () => {
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: "test",
          userIds: [userId3, userId4],
          producerId,
          eserviceId,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect({
      ...result,
      results: result.results.map(sortProducerKeychain),
    }).toEqual({
      totalCount: 1,
      results: [mockKeychain4].map(sortProducerKeychain),
    });
  });

  it(`should return empty result in case some owner filters are set and
      producerId is set to a tenant different from the requester`, async () => {
    const authData = getMockAuthData(producerId);
    const result1 = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: "test",
          userIds: [],
          producerId: generateId<TenantId>(),
          eserviceId: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );

    const result2 = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: undefined,
          userIds: [userId1],
          producerId: generateId<TenantId>(),
          eserviceId: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );

    const result3 = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: undefined,
          userIds: [],
          producerId: generateId<TenantId>(),
          eserviceId,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );

    expect(result1).toEqual({
      totalCount: 0,
      results: [],
    });
    expect(result2).toEqual(result1);
    expect(result3).toEqual(result1);
  });
});
