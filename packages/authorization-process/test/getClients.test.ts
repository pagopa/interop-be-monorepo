import {
  Client,
  PurposeId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getMockClient, getRandomAuthData } from "pagopa-interop-commons-test";
import { genericLogger, userRoles } from "pagopa-interop-commons";
import { addOneClient, authorizationService } from "./utils.js";

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
    users: [userId1, userId2],
    consumerId,
  };
  const userId3: UserId = generateId();
  const userId4: UserId = generateId();
  const mockClient4: Client = {
    ...getMockClient(),
    users: [userId3, userId4],
    consumerId,
  };

  const mockClient5: Client = {
    ...getMockClient(),
    purposes: [purposeId],
    consumerId,
  };

  const mockClient6: Client = {
    ...getMockClient(),
    purposes: [purposeId],
    consumerId,
  };

  it("should get the clients if they exist (parameters: name)", async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    const result = await authorizationService.getClients(
      {
        name: "test",
        userIds: [],
        consumerId,
        purposeId: undefined,
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(consumerId),
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockClient1, mockClient2]);
  });
  it("should get the clients if they exist (parameters: parameters userIds taken from the authData)", async () => {
    const userId: UserId = generateId();

    const mockClient7: Client = {
      ...mockClient3,
      users: [userId],
    };
    await addOneClient(mockClient7);

    const result = await authorizationService.getClients(
      {
        name: "",
        userIds: [generateId(), generateId()],
        consumerId,
        purposeId: undefined,
      },
      { offset: 0, limit: 50 },
      {
        ...getRandomAuthData(consumerId),
        userRoles: [userRoles.SECURITY_ROLE],
        userId,
      },
      genericLogger
    );

    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([mockClient7]);
  });
  it("should get the clients if they exist (parameters: parameters userIds taken from the filter)", async () => {
    await addOneClient(mockClient4);

    const result = await authorizationService.getClients(
      {
        name: "",
        userIds: [userId3, userId4],
        consumerId,
        purposeId: undefined,
      },
      { offset: 0, limit: 50 },
      {
        ...getRandomAuthData(consumerId),
        userRoles: [userRoles.INTERNAL_ROLE],
        userId: generateId(),
      },
      genericLogger
    );

    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([mockClient4]);
  });
  it("should get the clients if they exist (parameters: consumerId)", async () => {
    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    const result = await authorizationService.getClients(
      {
        userIds: [],
        consumerId,
        purposeId: undefined,
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(consumerId),
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
        consumerId,
        purposeId,
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(consumerId),
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
        consumerId,
        purposeId: undefined,
        kind: "Consumer",
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(consumerId),
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
      users: [userId1, userId4],
      consumerId,
    };

    const mockClientForOffset2: Client = {
      ...getMockClient(),
      users: [userId2, userId3],
      consumerId,
    };

    await addOneClient(mockClientForOffset1);
    await addOneClient(mockClientForOffset2);

    const result = await authorizationService.getClients(
      {
        userIds: [userId1, userId2, userId3, userId4],
        consumerId,
        purposeId: undefined,
      },
      { offset: 2, limit: 50 },
      getRandomAuthData(consumerId),
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
        userIds: [userId1, userId2, userId3, userId4],
        consumerId,
        purposeId: undefined,
      },
      { offset: 0, limit: 2 },
      getRandomAuthData(consumerId),
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
      getRandomAuthData(consumerId),
      genericLogger
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should get the clients if they exist (parameters: name, userIds, consumerId, purposeId, kind)", async () => {
    const completeClient1: Client = {
      ...getMockClient(),
      users: [userId2, userId3],
      consumerId,
      purposes: [purposeId],
    };

    const completeClient2: Client = {
      ...getMockClient(),
      users: [userId2, userId3],
      consumerId,
      purposes: [purposeId],
    };
    await addOneClient(completeClient1);
    await addOneClient(completeClient2);

    const result = await authorizationService.getClients(
      {
        name: "Test client",
        userIds: [userId1, userId2],
        consumerId,
        purposeId,
        kind: "Consumer",
      },
      { offset: 0, limit: 50 },
      getRandomAuthData(consumerId),
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([completeClient1, completeClient2]);
  });
});
