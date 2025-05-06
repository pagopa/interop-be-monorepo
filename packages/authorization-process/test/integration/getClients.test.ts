import {
  Client,
  PurposeId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  getMockClient,
  getMockAuthData,
  getMockContext,
  sortClient,
} from "pagopa-interop-commons-test";
import { userRole } from "pagopa-interop-commons";
import { addOneClient, authorizationService } from "../integrationUtils.js";

describe("getClients", async () => {
  const consumerId: TenantId = generateId();
  const purposeId: PurposeId = generateId();
  const mockClient1: Client = {
    ...getMockClient(),
    name: "test1",
    consumerId,
    kind: "Consumer",
  };
  const mockClient2: Client = {
    ...getMockClient(),
    name: "test2",
    consumerId,
    kind: "Consumer",
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
  const mockClient4: Client = {
    ...getMockClient(),
    name: "test4",
    users: [userId3, userId4],
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
    purposes: [purposeId],
    consumerId,
  };

  it("should get the clients if they exist (parameters: name)", async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    const result = await authorizationService.getClients(
      {
        filters: {
          name: "test",
          userIds: [],
          consumerId,
          purposeId: undefined,
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
      totalCount: 2,
      results: [mockClient1, mockClient2].map(sortClient),
    });
  });
  it("should get the clients if they exist (parameters: userIds taken from the authData)", async () => {
    const userId: UserId = generateId();
    const notUsedUserId: UserId = generateId();

    const mockClient7: Client = {
      ...mockClient3,
      users: [userId],
    };
    const mockClient8: Client = {
      ...mockClient3,
      id: generateId(),
      users: [notUsedUserId],
    };
    await addOneClient(mockClient7);
    await addOneClient(mockClient8);

    const result = await authorizationService.getClients(
      {
        filters: {
          name: "",
          userIds: [notUsedUserId],
          consumerId,
          purposeId: undefined,
        },
        offset: 0,
        limit: 50,
      },
      getMockContext({
        authData: getMockAuthData(consumerId, userId, [userRole.SECURITY_ROLE]),
      })
    );

    expect({
      ...result,
      results: result.results.map(sortClient),
    }).toEqual({
      totalCount: 1,
      results: [sortClient(mockClient7)],
    });
  });
  it("should get the clients if they exist (parameters: userIds taken from the filter)", async () => {
    const userId5: UserId = generateId();
    const userId6: UserId = generateId();

    const mockClient9: Client = {
      ...getMockClient(),
      users: [userId5, userId6],
      consumerId,
    };
    await addOneClient(mockClient9);

    const result = await authorizationService.getClients(
      {
        filters: {
          name: "",
          userIds: [userId5, userId6],
          consumerId,
          purposeId: undefined,
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
      results: [sortClient(mockClient9)],
    });
  });
  it("should get the clients if they exist (parameters: consumerId)", async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    const result = await authorizationService.getClients(
      {
        filters: {
          userIds: [],
          consumerId,
          purposeId: undefined,
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
      totalCount: 2,
      results: [mockClient1, mockClient2].map(sortClient),
    });
  });
  it("should get the clients if they exist (parameters: purposeId)", async () => {
    await addOneClient(mockClient5);
    await addOneClient(mockClient6);

    const result = await authorizationService.getClients(
      {
        filters: {
          userIds: [],
          consumerId,
          purposeId,
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
      totalCount: 2,
      results: [mockClient5, mockClient6].map(sortClient),
    });
  });
  it("should get the clients if they exist (parameters: kind)", async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    const result = await authorizationService.getClients(
      {
        filters: {
          userIds: [],
          consumerId,
          purposeId: undefined,
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
      totalCount: 2,
      results: [mockClient1, mockClient2].map(sortClient),
    });
  });
  it("should get the clients if they exist (pagination: offset)", async () => {
    await addOneClient(mockClient3);
    await addOneClient(mockClient4);
    const mockClientForOffset1: Client = {
      ...getMockClient(),
      name: "Test client for offset 1",
      users: [userId1, userId4],
      consumerId,
    };

    const mockClientForOffset2: Client = {
      ...getMockClient(),
      name: "Test client for offset 2",
      users: [userId2, userId3],
      consumerId,
    };

    await addOneClient(mockClientForOffset1);
    await addOneClient(mockClientForOffset2);

    const result = await authorizationService.getClients(
      {
        filters: {
          userIds: [userId1, userId2, userId3, userId4],
          consumerId,
          purposeId: undefined,
        },
        offset: 2,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(consumerId) })
    );
    expect(result.results.map(sortClient)).toEqual(
      [mockClientForOffset1, mockClientForOffset2].map(sortClient)
    );
  });
  it("should get the clients if they exist (pagination: limit)", async () => {
    const mockClientForLimit1: Client = {
      ...getMockClient(),
      users: [userId1, userId4],
      consumerId,
    };

    const mockClientForLimit2: Client = {
      ...getMockClient(),
      users: [userId2, userId3],
      consumerId,
    };
    await addOneClient(mockClient3);
    await addOneClient(mockClient4);
    await addOneClient(mockClientForLimit1);
    await addOneClient(mockClientForLimit2);

    const result = await authorizationService.getClients(
      {
        filters: {
          userIds: [userId1, userId2, userId3, userId4],
          consumerId,
          purposeId: undefined,
        },
        offset: 0,
        limit: 2,
      },
      getMockContext({ authData: getMockAuthData(consumerId) })
    );
    expect(result.results.map(sortClient)).toEqual(
      [mockClient3, mockClient4].map(sortClient)
    );
  });
  it("should not get the clients if they don't exist", async () => {
    await addOneClient(mockClient1);
    const result = await authorizationService.getClients(
      {
        filters: {
          userIds: [],
          consumerId: generateId(),
          purposeId: undefined,
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
    const completeClient1: Client = {
      ...getMockClient(),
      name: "Test client 1",
      users: [userId2, userId3],
      consumerId,
      purposes: [purposeId],
    };

    const completeClient2: Client = {
      ...getMockClient(),
      name: "Test client 2",
      users: [userId2, userId3],
      consumerId,
      purposes: [purposeId],
    };
    await addOneClient(completeClient1);
    await addOneClient(completeClient2);

    const result = await authorizationService.getClients(
      {
        filters: {
          name: "Test client",
          userIds: [userId1, userId2],
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
      totalCount: 2,
      results: [completeClient1, completeClient2].map(sortClient),
    });
  });
});
