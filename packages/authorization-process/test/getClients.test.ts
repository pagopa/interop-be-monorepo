import {
  Client,
  PurposeId,
  TenantId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getMockClient, getRandomAuthData } from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { addOneClient, authorizationService } from "./utils.js";

describe("getClients", async () => {
  const consumerId = generateId();
  const purposeId = generateId();
  const mockClient1: Client = {
    ...getMockClient(),
    name: "test1",
    consumerId: unsafeBrandId(consumerId),
    kind: "Consumer",
  };
  const mockClient2: Client = {
    ...getMockClient(),
    name: "test2",
    consumerId: unsafeBrandId(consumerId),
    kind: "Consumer",
  };

  const userId1 = generateId();
  const userId2 = generateId();
  const mockClient3: Client = {
    ...getMockClient(),
    users: [unsafeBrandId(userId1), unsafeBrandId(userId2)],
    consumerId: unsafeBrandId(consumerId),
  };
  const userIds3 = generateId();
  const userIds4 = generateId();
  const mockClient4: Client = {
    ...getMockClient(),
    users: [unsafeBrandId(userIds3), unsafeBrandId(userIds4)],
    consumerId: unsafeBrandId(consumerId),
  };

  const mockClient5: Client = {
    ...getMockClient(),
    purposes: [unsafeBrandId<PurposeId>(purposeId)],
    consumerId: unsafeBrandId(consumerId),
  };

  const mockClient6: Client = {
    ...getMockClient(),
    purposes: [unsafeBrandId<PurposeId>(purposeId)],
    consumerId: unsafeBrandId(consumerId),
  };

  it("should get the clients if they exist (parameters: name)", async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    const result = await authorizationService.getClients(
      {
        name: "test",
        userIds: [],
        consumerId: unsafeBrandId(consumerId),
        purposeId: undefined,
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockClient1, mockClient2]);
  });
  it("should get the clients if they exist (parameters: userIds)", async () => {
    await addOneClient(mockClient3);
    await addOneClient(mockClient4);

    const result = await authorizationService.getClients(
      {
        name: "",
        userIds: [
          unsafeBrandId(userId1),
          unsafeBrandId(userId2),
          unsafeBrandId(userIds3),
          unsafeBrandId(userIds4),
        ],
        consumerId: unsafeBrandId(consumerId),
        purposeId: undefined,
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );

    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockClient3, mockClient4]);
  });
  it("should get the clients if they exist (parameters: consumerId)", async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    const result = await authorizationService.getClients(
      {
        userIds: [],
        consumerId: unsafeBrandId(consumerId),
        purposeId: undefined,
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockClient1, mockClient2]);
  });
  it("should get the clients if they exist (parameters: purposeId)", async () => {
    await addOneClient(mockClient5);
    await addOneClient(mockClient6);

    const result = await authorizationService.getClients(
      {
        userIds: [],
        consumerId: unsafeBrandId(consumerId),
        purposeId: unsafeBrandId<PurposeId>(purposeId),
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockClient5, mockClient6]);
  });
  it("should get the clients if they exist (parameters: kind)", async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    const result = await authorizationService.getClients(
      {
        userIds: [],
        consumerId: unsafeBrandId(consumerId),
        purposeId: undefined,
        kind: "Consumer",
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockClient1, mockClient2]);
  });

  it("should get the clients if they exist (pagination: offset)", async () => {
    await addOneClient(mockClient3);
    await addOneClient(mockClient4);
    const mockClientForOffset1: Client = {
      ...getMockClient(),
      users: [unsafeBrandId(userId1), unsafeBrandId(userIds4)],
      consumerId: unsafeBrandId(consumerId),
    };

    const mockClientForOffset2: Client = {
      ...getMockClient(),
      users: [unsafeBrandId(userId2), unsafeBrandId(userIds3)],
      consumerId: unsafeBrandId(consumerId),
    };

    await addOneClient(mockClientForOffset1);
    await addOneClient(mockClientForOffset2);

    const result = await authorizationService.getClients(
      {
        userIds: [
          unsafeBrandId(userId1),
          unsafeBrandId(userId2),
          unsafeBrandId(userIds3),
          unsafeBrandId(userIds4),
        ],
        consumerId: unsafeBrandId(consumerId),
        purposeId: undefined,
      },
      { offset: 2, limit: 50 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );
    expect(result.results).toEqual([
      mockClientForOffset1,
      mockClientForOffset2,
    ]);
  });
  it("should get the clients if they exist (pagination: limit)", async () => {
    const mockClientForLimit1: Client = {
      ...getMockClient(),
      users: [unsafeBrandId(userId1), unsafeBrandId(userIds4)],
      consumerId: unsafeBrandId(consumerId),
    };

    const mockClientForLimit2: Client = {
      ...getMockClient(),
      users: [unsafeBrandId(userId2), unsafeBrandId(userIds3)],
      consumerId: unsafeBrandId(consumerId),
    };
    await addOneClient(mockClient3);
    await addOneClient(mockClient4);
    await addOneClient(mockClientForLimit1);
    await addOneClient(mockClientForLimit2);

    const result = await authorizationService.getClients(
      {
        userIds: [
          unsafeBrandId(userId1),
          unsafeBrandId(userId2),
          unsafeBrandId(userIds3),
          unsafeBrandId(userIds4),
        ],
        consumerId: unsafeBrandId(consumerId),
        purposeId: undefined,
      },
      { offset: 0, limit: 2 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );
    expect(result.results).toEqual([mockClient3, mockClient4]);
  });
  it("should not get the clients if they don't exist", async () => {
    await addOneClient(mockClient1);
    const result = await authorizationService.getClients(
      {
        userIds: [],
        consumerId: generateId(),
        purposeId: undefined,
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should get the clients if they exist (parameters: name, userIds, consumerId, purposeId, kind)", async () => {
    const completeClient1: Client = {
      ...getMockClient(),
      users: [unsafeBrandId(userId2), unsafeBrandId(userIds3)],
      consumerId: unsafeBrandId(consumerId),
      purposes: [unsafeBrandId<PurposeId>(purposeId)],
    };

    const completeClient2: Client = {
      ...getMockClient(),
      users: [unsafeBrandId(userId2), unsafeBrandId(userIds3)],
      consumerId: unsafeBrandId(consumerId),
      purposes: [unsafeBrandId<PurposeId>(purposeId)],
    };
    await addOneClient(completeClient1);
    await addOneClient(completeClient2);

    const result = await authorizationService.getClients(
      {
        name: "Test client",
        userIds: [unsafeBrandId(userId1), unsafeBrandId(userId2)],
        consumerId: unsafeBrandId(consumerId),
        purposeId: unsafeBrandId<PurposeId>(purposeId),
        kind: "Consumer",
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(unsafeBrandId<TenantId>(consumerId)),
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([completeClient1, completeClient2]);
  });
});
