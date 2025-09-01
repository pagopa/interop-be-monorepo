import {
  Client,
  PurposeId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMockClient,
  getMockAuthData,
  getMockContext,
  sortClient,
} from "pagopa-interop-commons-test";
import { userRole } from "pagopa-interop-commons";
import {
  addOneClient,
  authorizationService,
  readModelService,
} from "../integrationUtils.js";
import { GetClientsFilters } from "../../src/services/readModelServiceSQL.js";

describe("getClients", async () => {
  const consumerId: TenantId = generateId();

  const mockClient1: Client = {
    ...getMockClient(),
    name: "a test client 1",
    consumerId,
    kind: "Consumer",
  };
  const mockClient2: Client = {
    ...getMockClient(),
    name: "a test client 2",
    consumerId,
    kind: "Api",
  };

  const userId1: UserId = generateId();
  const userId2: UserId = generateId();
  const mockClient3: Client = {
    ...getMockClient(),
    name: "test3",
    users: [userId1, userId2],
    consumerId,
  };
  const userId3: UserId = generateId();
  const userId4: UserId = generateId();
  const purposeId: PurposeId = generateId();
  const mockClient4: Client = {
    ...getMockClient(),
    name: "test4",
    users: [userId3, userId4],
    purposes: [purposeId],
    consumerId,
  };

  const mockClient5: Client = {
    ...getMockClient(),
    name: "test5",
    purposes: [purposeId],
    consumerId,
  };

  const mockClient6: Client = {
    ...getMockClient(),
    name: "test6",
    consumerId: generateId<TenantId>(),
    users: [userId1, userId2],
    purposes: [purposeId],
  };

  beforeEach(async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    await addOneClient(mockClient3);
    await addOneClient(mockClient4);
    await addOneClient(mockClient5);
    await addOneClient(mockClient6);
  });

  it("should get all clients when no filters are set", async () => {
    const authData = getMockAuthData(consumerId);
    const result = await authorizationService.getClients(
      {
        filters: {
          name: undefined,
          userIds: [],
          consumerId: undefined,
          purposeId: undefined,
          kind: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );
    expect({
      ...result,
      results: result.results.map(sortClient),
    }).toEqual({
      totalCount: 6,
      results: [
        mockClient1,
        mockClient2,
        mockClient3,
        mockClient4,
        mockClient5,
        mockClient6,
      ].map(sortClient),
    });
  });

  it("should get the clients if they exist (parameters: name)", async () => {
    const spyQuery = vi.spyOn(readModelService, "getClients");
    const authData = getMockAuthData(consumerId);

    const filters: GetClientsFilters = {
      name: "test client",
      userIds: [],
      consumerId: undefined,
      purposeId: undefined,
      kind: undefined,
    };
    const result = await authorizationService.getClients(
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
        consumerId: authData.organizationId,
        // ^ Client name is visible only to client owner.
        // When name is set, the consumerId filter is overridden with the caller tenant
        // so that only clients owned by the caller are returned.
      },
      {
        offset: 0,
        limit: 50,
      }
    );

    expect({
      ...result,
      results: result.results.map(sortClient),
    }).toEqual({
      totalCount: 2,
      results: [mockClient1, mockClient2].map(sortClient),
    });
  });

  it("should get the clients if they exist (parameters: userIds taken from the authData)", async () => {
    const spyQuery = vi.spyOn(readModelService, "getClients");
    const authData = getMockAuthData(consumerId, userId1, [
      userRole.SECURITY_ROLE,
    ]);

    const filters: GetClientsFilters = {
      name: "",
      userIds: [],
      consumerId: undefined,
      purposeId: undefined,
      kind: undefined,
    };

    const result = await authorizationService.getClients(
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
      results: result.results.map(sortClient),
    }).toEqual({
      totalCount: 2,
      results: [mockClient3, mockClient6].map(sortClient),
    });
  });

  it("should get the clients if they exist (parameters: consumerId, userIds taken from the filter)", async () => {
    const spyQuery = vi.spyOn(readModelService, "getClients");
    const authData = getMockAuthData(consumerId);
    const filters: GetClientsFilters = {
      name: "",
      userIds: [userId1, userId3],
      consumerId: undefined,
      purposeId: undefined,
      kind: undefined,
    };
    const result = await authorizationService.getClients(
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
        consumerId: authData.organizationId,
        // Client users are visible only to client owner.
        // When userIds is set, the consumerId filter is overridden with the caller tenant
        // so that only clients owned by the caller are returned.
      },
      {
        offset: 0,
        limit: 50,
      }
    );

    expect({
      ...result,
      results: result.results.map(sortClient),
    }).toEqual({
      totalCount: 2,
      results: [mockClient3, mockClient4].map(sortClient),
    });
  });

  it("should get the clients if they exist (parameters: consumerId)", async () => {
    const result = await authorizationService.getClients(
      {
        filters: {
          name: undefined,
          userIds: [],
          consumerId,
          purposeId: undefined,
          kind: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(consumerId) })
    );
    expect({
      ...result,
      results: result.results.map(sortClient),
    }).toEqual({
      totalCount: 5,
      results: [
        mockClient1,
        mockClient2,
        mockClient3,
        mockClient4,
        mockClient5,
      ].map(sortClient),
    });
  });

  it("should get the clients if they exist (parameters: purposeId)", async () => {
    const spyQuery = vi.spyOn(readModelService, "getClients");
    const authData = getMockAuthData(consumerId);

    const filters: GetClientsFilters = {
      name: undefined,
      userIds: [],
      consumerId: undefined,
      purposeId,
      kind: undefined,
    };
    const result = await authorizationService.getClients(
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
        consumerId: authData.organizationId,
        // Client purposes are visible only to client owner.
        // When purposeId is set, the consumerId filter is overridden with the caller tenant
        // so that only clients owned by the caller are returned.
      },
      {
        offset: 0,
        limit: 50,
      }
    );

    expect({
      ...result,
      results: result.results.map(sortClient),
    }).toEqual({
      totalCount: 2,
      results: [mockClient4, mockClient5].map(sortClient),
    });
  });

  it("should get the clients if they exist (parameters: kind)", async () => {
    const result1 = await authorizationService.getClients(
      {
        filters: {
          name: undefined,
          userIds: [],
          consumerId: undefined,
          purposeId: undefined,
          kind: "Consumer",
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(consumerId) })
    );
    expect({
      ...result1,
      results: result1.results.map(sortClient),
    }).toEqual({
      totalCount: 5,
      results: [
        mockClient1,
        mockClient3,
        mockClient4,
        mockClient5,
        mockClient6,
      ].map(sortClient),
    });
  });

  it("should get the clients if they exist (pagination: offset)", async () => {
    const result = await authorizationService.getClients(
      {
        filters: {
          name: undefined,
          userIds: [],
          consumerId,
          purposeId: undefined,
          kind: undefined,
        },
        offset: 2,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(consumerId) })
    );
    expect(result.results.map(sortClient)).toEqual(
      [mockClient3, mockClient4, mockClient5].map(sortClient)
    );
  });

  it("should get the clients if they exist (pagination: limit)", async () => {
    const result = await authorizationService.getClients(
      {
        filters: {
          name: undefined,
          userIds: [],
          consumerId,
          purposeId: undefined,
          kind: undefined,
        },
        offset: 0,
        limit: 2,
      },
      getMockContext({ authData: getMockAuthData(consumerId) })
    );
    expect(result.results.map(sortClient)).toEqual(
      [mockClient1, mockClient2].map(sortClient)
    );
  });

  it("should not get the clients if they don't exist", async () => {
    const result = await authorizationService.getClients(
      {
        filters: {
          name: undefined,
          userIds: [],
          consumerId: generateId<TenantId>(),
          purposeId: undefined,
          kind: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(consumerId) })
    );
    expect(result).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should get the clients if they exist (parameters: name, userIds, consumerId, purposeId, kind)", async () => {
    const result = await authorizationService.getClients(
      {
        filters: {
          name: "test",
          userIds: [userId3, userId4],
          consumerId,
          purposeId,
          kind: "Consumer",
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(consumerId) })
    );
    expect({
      ...result,
      results: result.results.map(sortClient),
    }).toEqual({
      totalCount: 1,
      results: [mockClient4].map(sortClient),
    });
  });

  it(`should return empty result in case some owner filters are set and
        consumerId is set to a tenant different from the requester`, async () => {
    const authData = getMockAuthData(consumerId);
    const result1 = await authorizationService.getClients(
      {
        filters: {
          name: "test",
          userIds: [],
          consumerId: generateId<TenantId>(),
          purposeId: undefined,
          kind: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );

    const result2 = await authorizationService.getClients(
      {
        filters: {
          name: undefined,
          userIds: [userId1],
          consumerId: generateId<TenantId>(),
          purposeId: undefined,
          kind: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData })
    );

    const result3 = await authorizationService.getClients(
      {
        filters: {
          name: undefined,
          userIds: [],
          consumerId: generateId<TenantId>(),
          purposeId,
          kind: undefined,
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
