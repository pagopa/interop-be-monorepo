import {
  ProducerKeychain,
  TenantId,
  EServiceId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  getMockAuthData,
  getMockContext,
  getMockProducerKeychain,
  sortProducerKeychain,
} from "pagopa-interop-commons-test";
import { userRole } from "pagopa-interop-commons";
import {
  addOneProducerKeychain,
  authorizationService,
} from "../integrationUtils.js";

describe("getProducerKeychains", async () => {
  const producerId: TenantId = generateId();
  const eserviceId: EServiceId = generateId();
  const mockProducerKeychain1: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test1",
    eservices: [eserviceId],
    producerId,
  };
  const mockProducerKeychain2: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test2",
    eservices: [eserviceId],
    producerId,
  };

  const userId1: UserId = generateId();
  const userId2: UserId = generateId();
  const mockProducerKeychain3: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test3",
    users: [userId1, userId2],
    producerId,
  };
  const userId3: UserId = generateId();
  const userId4: UserId = generateId();
  const mockProducerKeychain4: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test4",
    users: [userId3, userId4],
    producerId,
  };

  const mockProducerKeychain5: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test5",
    eservices: [eserviceId],
    producerId,
  };

  const mockProducerKeychain6: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test6",
    eservices: [eserviceId],
    producerId,
  };

  it("should get the producer keychains if they exist (parameters: name)", async () => {
    await addOneProducerKeychain(mockProducerKeychain1);
    await addOneProducerKeychain(mockProducerKeychain2);
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: "test",
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
      totalCount: 2,
      results: [mockProducerKeychain1, mockProducerKeychain2],
    });
  });
  it("should get the producer keychains if they exist (parameters: userIds taken from the authData)", async () => {
    const userId: UserId = generateId();
    const notUsedUserId: UserId = generateId();

    const mockProducerKeychain7: ProducerKeychain = {
      ...mockProducerKeychain3,
      users: [userId],
    };
    const mockProducerKeychain8: ProducerKeychain = {
      ...mockProducerKeychain3,
      id: generateId(),
      users: [notUsedUserId],
    };
    await addOneProducerKeychain(mockProducerKeychain7);
    await addOneProducerKeychain(mockProducerKeychain8);

    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: "",
          userIds: [notUsedUserId],
          producerId,
          eserviceId: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({
        authData: getMockAuthData(producerId, userId, [userRole.SECURITY_ROLE]),
      })
    );

    expect({
      ...result,
      results: result.results.map(sortProducerKeychain),
    }).toEqual({
      totalCount: 1,
      results: [sortProducerKeychain(mockProducerKeychain7)],
    });
  });
  it("should get the producer keychains if they exist (parameters: userIds taken from the filter)", async () => {
    const userId5: UserId = generateId();
    const userId6: UserId = generateId();

    const mockProducerKeychain9: ProducerKeychain = {
      ...getMockProducerKeychain(),
      users: [userId5, userId6],
      producerId,
    };
    await addOneProducerKeychain(mockProducerKeychain9);

    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: "",
          userIds: [userId5, userId6],
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
      totalCount: 1,
      results: [sortProducerKeychain(mockProducerKeychain9)],
    });
  });
  it("should get the producer keychains if they exist (parameters: producerId)", async () => {
    await addOneProducerKeychain(mockProducerKeychain1);
    await addOneProducerKeychain(mockProducerKeychain2);
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
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
      totalCount: 2,
      results: [mockProducerKeychain1, mockProducerKeychain2].map(
        sortProducerKeychain
      ),
    });
  });
  it("should get the producer keychains if they exist (parameters: eserviceId)", async () => {
    await addOneProducerKeychain(mockProducerKeychain5);
    await addOneProducerKeychain(mockProducerKeychain6);

    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          userIds: [],
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
      totalCount: 2,
      results: [mockProducerKeychain5, mockProducerKeychain6].map(
        sortProducerKeychain
      ),
    });
  });
  it("should get the producer keychains if they exist (pagination: offset)", async () => {
    await addOneProducerKeychain(mockProducerKeychain3);
    await addOneProducerKeychain(mockProducerKeychain4);
    const mockProducerKeychainForOffset1: ProducerKeychain = {
      ...getMockProducerKeychain(),
      name: "Test producer keychain for offset 1",
      users: [userId1, userId4],
      producerId,
    };

    const mockProducerKeychainForOffset2: ProducerKeychain = {
      ...getMockProducerKeychain(),
      name: "Test producer keychain for offset 2",
      users: [userId2, userId3],
      producerId,
    };

    await addOneProducerKeychain(mockProducerKeychainForOffset1);
    await addOneProducerKeychain(mockProducerKeychainForOffset2);

    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          userIds: [userId1, userId2, userId3, userId4],
          producerId,
          eserviceId: undefined,
        },
        offset: 2,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(result.results.map(sortProducerKeychain)).toEqual(
      [mockProducerKeychainForOffset1, mockProducerKeychainForOffset2].map(
        sortProducerKeychain
      )
    );
  });
  it("should get the producer keychains if they exist (pagination: limit)", async () => {
    const mockProducerKeychainForLimit1: ProducerKeychain = {
      ...getMockProducerKeychain(),
      name: "Test producer keychain for limit 1",
      users: [userId1, userId4],
      producerId,
    };

    const mockProducerKeychainForLimit2: ProducerKeychain = {
      ...getMockProducerKeychain(),
      name: "Test producer keychain for limit 2",
      users: [userId2, userId3],
      producerId,
    };
    await addOneProducerKeychain(mockProducerKeychain3);
    await addOneProducerKeychain(mockProducerKeychain4);
    await addOneProducerKeychain(mockProducerKeychainForLimit1);
    await addOneProducerKeychain(mockProducerKeychainForLimit2);

    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          userIds: [userId1, userId2, userId3, userId4],
          producerId,
          eserviceId: undefined,
        },
        offset: 0,
        limit: 2,
      },
      getMockContext({ authData: getMockAuthData(producerId) })
    );
    expect(result.results.map(sortProducerKeychain)).toEqual(
      [mockProducerKeychain3, mockProducerKeychain4].map(sortProducerKeychain)
    );
  });
  it("should not get the producer keychains if they don't exist", async () => {
    await addOneProducerKeychain(mockProducerKeychain1);
    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
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
  it("should get the producer keychains if they exist (parameters: name, userIds, producerId, eserviceId)", async () => {
    const completeProducerKeychain1: ProducerKeychain = {
      ...getMockProducerKeychain(),
      name: "Test producer keychain 1",
      users: [userId2, userId3],
      producerId,
      eservices: [eserviceId],
    };

    const completeProducerKeychain2: ProducerKeychain = {
      ...getMockProducerKeychain(),
      name: "Test producer keychain 2",
      users: [userId2, userId3],
      producerId,
      eservices: [eserviceId],
    };
    await addOneProducerKeychain(completeProducerKeychain1);
    await addOneProducerKeychain(completeProducerKeychain2);

    const result = await authorizationService.getProducerKeychains(
      {
        filters: {
          name: "Test producer keychain",
          userIds: [userId1, userId2],
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
      totalCount: 2,
      results: [completeProducerKeychain1, completeProducerKeychain2].map(
        sortProducerKeychain
      ),
    });
  });
});
