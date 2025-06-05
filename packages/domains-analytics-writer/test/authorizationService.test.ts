import { describe, it, expect, beforeEach } from "vitest";
import {
  toClientV1,
  ClientAddedV1,
  AuthorizationEventEnvelopeV1,
  ClientV1,
  UserId,
  generateId,
  PurposeId,
  Key,
  AuthorizationEventEnvelopeV2,
  toClientV2,
  ClientV2,
  ClientAddedV2,
  ClientDeletedV1,
  ClientPurposeAddedV1,
  ClientPurposeRemovedV1,
  UserAddedV1,
  UserRemovedV1,
  ClientComponentStateV1,
  ClientDeletedV2,
  ClientUserAddedV2,
  ClientPurposeAddedV2,
} from "pagopa-interop-models";
import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import { handleAuthorizationMessageV1 } from "../src/handlers/authorization/consumerServiceV1.js";
import { ClientDbTable } from "../src/model/db/authorization.js";
import { handleAuthorizationEventMessageV2 } from "../src/handlers/authorization/consumerServiceV2.js";
import {
  dbContext,
  resetTargetTables,
  getManyFromDb,
  getOneFromDb,
  clientTables,
} from "./utils.js";

describe("Authorization messages consumers - handleAuthorizationMessageV1", () => {
  const mockClient = getMockClient();
  const mockMessage: Omit<AuthorizationEventEnvelopeV1, "type" | "data"> = {
    event_version: 1,
    stream_id: mockClient.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
  };

  beforeEach(async () => {
    await resetTargetTables(clientTables);
  });

  it("ClientAdded: inserts client with users and purposes", async () => {
    const userId: UserId = generateId<UserId>();
    const purposeId: PurposeId = generateId();

    const client: ClientV1 = toClientV1({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
    });

    const payload: ClientAddedV1 = { client };

    const msg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payload,
    };

    await handleAuthorizationMessageV1([msg], dbContext);

    const storedClient = await getOneFromDb(dbContext, ClientDbTable.client, {
      id: client.id,
    });
    expect(storedClient).toBeDefined();
    expect(storedClient.name).toBe(mockClient.name);
    expect(storedClient.metadataVersion).toBe(1);

    const storedUsers = await getManyFromDb(
      dbContext,
      ClientDbTable.client_user,
      {
        clientId: client.id,
        userId,
      }
    );
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0].userId).toBe(userId);
    expect(storedUsers[0].metadataVersion).toBe(1);

    const storedPurposes = await getManyFromDb(
      dbContext,
      ClientDbTable.client_purpose,
      {
        clientId: client.id,
        purposeId,
      }
    );
    expect(storedPurposes).toHaveLength(1);
    expect(storedPurposes[0].purposeId).toBe(purposeId);
    expect(storedPurposes[0].metadataVersion).toBe(1);
  });

  it("ClientDeleted: marks client and relations as deleted", async () => {
    const userId = generateId<UserId>();
    const purposeId = generateId<PurposeId>();

    const client = toClientV1({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
    });

    const payloadAdd: ClientAddedV1 = { client };
    const payloadDelete: ClientDeletedV1 = { clientId: client.id };

    const addMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payloadAdd,
    };

    const deleteMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 2,
      type: "ClientDeleted",
      data: payloadDelete,
    };

    await handleAuthorizationMessageV1([addMsg, deleteMsg], dbContext);

    const storedClient = await getOneFromDb(dbContext, ClientDbTable.client, {
      id: client.id,
    });
    expect(storedClient.deleted).toBe(true);

    const checks = [
      { table: ClientDbTable.client_user, where: { clientId: client.id } },
      { table: ClientDbTable.client_purpose, where: { clientId: client.id } },
    ];

    for (const { table, where } of checks) {
      const rows = await getManyFromDb(dbContext, table, where);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((r) => expect(r.deleted).toBe(true));
    }
  });

  it("UserAdded: adds user to client", async () => {
    const userId = generateId<UserId>();
    const client = toClientV1({ ...mockClient });

    const payloadAdd: ClientAddedV1 = { client };
    const payloadUser: UserAddedV1 = { client, userId };

    const addMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payloadAdd,
    };

    const userMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 2,
      type: "UserAdded",
      data: payloadUser,
    };

    await handleAuthorizationMessageV1([addMsg, userMsg], dbContext);

    const users = await getManyFromDb(dbContext, ClientDbTable.client_user, {
      clientId: client.id,
      userId,
    });
    expect(users).toHaveLength(1);
    expect(users[0].userId).toBe(userId);
  });

  it("UserRemoved: removes user from client", async () => {
    const userId = generateId<UserId>();
    const client = toClientV1({ ...mockClient, users: [userId] });

    const payloadAdd: ClientAddedV1 = { client };
    const payloadRemove: UserRemovedV1 = { client, userId };

    const addMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payloadAdd,
    };

    const removeMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 2,
      type: "UserRemoved",
      data: payloadRemove,
    };

    await handleAuthorizationMessageV1([addMsg, removeMsg], dbContext);

    const users = await getManyFromDb(dbContext, ClientDbTable.client_user, {
      clientId: client.id,
      userId,
    });
    expect(users[0].deleted).toBe(true);
  });

  it("ClientPurposeAdded: adds purpose to client", async () => {
    const purposeId: PurposeId = generateId();

    const client = toClientV1({
      ...mockClient,
      purposes: [purposeId],
    });

    const payloadAdd: ClientAddedV1 = { client };
    const payloadPurpose: ClientPurposeAddedV1 = {
      clientId: client.id,
      statesChain: {
        id: generateId(),
        purpose: {
          purposeId,
          state: ClientComponentStateV1.ACTIVE,
          versionId: generateId(),
        },
      },
    };

    const addMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payloadAdd,
    };

    const purposeMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientPurposeAdded",
      version: 2,
      data: payloadPurpose,
    };

    await handleAuthorizationMessageV1([addMsg, purposeMsg], dbContext);

    const purposes = await getManyFromDb(
      dbContext,
      ClientDbTable.client_purpose,
      {
        clientId: client.id,
        purposeId,
      }
    );
    expect(purposes).toHaveLength(1);
    expect(purposes[0].purposeId).toBe(purposeId);
  });

  it("ClientPurposeRemoved: removes purpose from client", async () => {
    const purposeId = generateId<PurposeId>();
    const client = toClientV1({ ...mockClient, purposes: [purposeId] });

    const payloadAdd: ClientAddedV1 = { client };
    const payloadRemove: ClientPurposeRemovedV1 = {
      clientId: client.id,
      purposeId,
    };

    const addMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payloadAdd,
    };

    const removeMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 2,
      type: "ClientPurposeRemoved",
      data: payloadRemove,
    };

    await handleAuthorizationMessageV1([addMsg, removeMsg], dbContext);

    const purposes = await getManyFromDb(
      dbContext,
      ClientDbTable.client_purpose,
      {
        clientId: client.id,
        purposeId,
      }
    );
    expect(purposes[0].deleted).toBe(true);
  });

  it("ClientAdded: should throw error when client is missing", async () => {
    const msg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: {} as unknown as ClientAddedV1,
    };

    await expect(() =>
      handleAuthorizationMessageV1([msg], dbContext)
    ).rejects.toThrow("Client can't be missing in event message");
  });

  it("UserAdded: should throw error when client is missing", async () => {
    const msg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 2,
      type: "UserAdded",
      data: {} as unknown as UserAddedV1,
    };

    await expect(() =>
      handleAuthorizationMessageV1([msg], dbContext)
    ).rejects.toThrow("Client can't be missing in event message");
  });

  it("UserRemoved: should throw error when client is missing", async () => {
    const msg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 2,
      type: "UserRemoved",
      data: {} as unknown as UserRemovedV1,
    };

    await expect(() =>
      handleAuthorizationMessageV1([msg], dbContext)
    ).rejects.toThrow("Client can't be missing in event message");
  });

  it("ClientPurposeAdded: should throw error when purposeId is missing", async () => {
    const msg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 2,
      type: "ClientPurposeAdded",
      data: {} as unknown as ClientPurposeAddedV1,
    };

    await expect(() =>
      handleAuthorizationMessageV1([msg], dbContext)
    ).rejects.toThrow("purposeId can't be missing in event message");
  });

  it("UserAdded: should skip update when incoming metadata_version is lower or equal", async () => {
    const userId = generateId<UserId>();
    const client = toClientV1({ ...mockClient });

    const payloadV1: ClientAddedV1 = { client };
    const payloadUserV1: UserAddedV1 = { client, userId };
    const payloadUserV3: UserAddedV1 = {
      client: { ...client, name: "V3" },
      userId,
    };
    const payloadUserV2: UserAddedV1 = {
      client: { ...client, name: "V2" },
      userId,
    };

    const addMsg: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payloadV1,
    };

    const userMsgV1: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 1,
      type: "UserAdded",
      data: payloadUserV1,
    };

    const userMsgV3: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 3,
      type: "UserAdded",
      data: payloadUserV3,
    };

    const userMsgV2: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      version: 2,
      type: "UserAdded",
      data: payloadUserV2,
    };

    await handleAuthorizationMessageV1([addMsg, userMsgV1], dbContext);
    await handleAuthorizationMessageV1([userMsgV3], dbContext);
    await handleAuthorizationMessageV1([userMsgV2], dbContext);

    const users = await getManyFromDb(dbContext, ClientDbTable.client_user, {
      clientId: client.id,
      userId,
    });

    expect(users).toHaveLength(1);
    expect(users[0].metadataVersion).toBe(3);
  });
});

describe("Authorization messages consumers - handleAuthorizationMessageV2", () => {
  const mockClient = getMockClient();
  const mockMessage: Omit<AuthorizationEventEnvelopeV2, "type" | "data"> = {
    event_version: 2,
    stream_id: mockClient.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
  };

  beforeEach(async () => {
    await resetTargetTables(clientTables);
  });

  it("ClientAdded: inserts client with users and purposes", async () => {
    const userId: UserId = generateId<UserId>();
    const purposeId: PurposeId = generateId();
    const key: Key = { ...getMockKey(), userId };

    const client: ClientV2 = toClientV2({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
      keys: [key],
    });

    const payload: ClientAddedV2 = { client };

    const msg: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payload,
    };

    await handleAuthorizationEventMessageV2([msg], dbContext);

    const storedClient = await getOneFromDb(dbContext, ClientDbTable.client, {
      id: client.id,
    });
    expect(storedClient).toBeDefined();
    expect(storedClient.name).toBe(mockClient.name);
    expect(storedClient.metadataVersion).toBe(1);

    const storedUsers = await getManyFromDb(
      dbContext,
      ClientDbTable.client_user,
      {
        clientId: client.id,
        userId,
      }
    );
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0].userId).toBe(userId);
    expect(storedUsers[0].metadataVersion).toBe(1);

    const storedPurposes = await getManyFromDb(
      dbContext,
      ClientDbTable.client_purpose,
      {
        clientId: client.id,
        purposeId,
      }
    );
    expect(storedPurposes).toHaveLength(1);
    expect(storedPurposes[0].purposeId).toBe(purposeId);
    expect(storedPurposes[0].metadataVersion).toBe(1);

    const storedKeys = await getManyFromDb(
      dbContext,
      ClientDbTable.client_key,
      {
        clientId: client.id,
        kid: key.kid,
      }
    );
    expect(storedKeys).toHaveLength(1);
    expect(storedKeys[0].userId).toBe(userId);
    expect(storedKeys[0].createdAt).toBeDefined();
    expect(storedKeys[0].metadataVersion).toBe(1);
  });

  it("ClientDeleted: marks client and relations as deleted", async () => {
    const userId = generateId<UserId>();
    const purposeId = generateId<PurposeId>();
    const key = { ...getMockKey(), userId };

    const client = toClientV2({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
      keys: [key],
    });

    const payloadAdd: ClientAddedV2 = { client };
    const payloadDelete: ClientDeletedV2 = { clientId: client.id };

    const addMsg: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payloadAdd,
    };

    const deleteMsg: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      version: 2,
      type: "ClientDeleted",
      data: payloadDelete,
    };

    await handleAuthorizationEventMessageV2([addMsg, deleteMsg], dbContext);

    const storedClient = await getOneFromDb(dbContext, ClientDbTable.client, {
      id: client.id,
    });
    expect(storedClient.deleted).toBe(true);

    const checks = [
      { table: ClientDbTable.client_user, where: { clientId: client.id } },
      { table: ClientDbTable.client_purpose, where: { clientId: client.id } },
      { table: ClientDbTable.client_key, where: { clientId: client.id } },
    ];

    for (const { table, where } of checks) {
      const rows = await getManyFromDb(dbContext, table, where);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((r) => expect(r.deleted).toBe(true));
    }
  });

  it("ClientUserAdded: should throw error when client is missing", async () => {
    const msg: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      version: 2,
      type: "ClientUserAdded",
      data: {} as unknown as ClientUserAddedV2,
    };

    await expect(() =>
      handleAuthorizationEventMessageV2([msg], dbContext)
    ).rejects.toThrow("Client can't be missing in event message");
  });

  it("ClientPurposeAdded: should skip update when incoming metadata_version is lower or equal", async () => {
    const purposeId = generateId<PurposeId>();
    const client = toClientV2({
      ...mockClient,
      purposes: [purposeId],
    });

    const payloadV1: ClientAddedV2 = { client };
    const clientV3 = { ...client, name: "V3" };
    const clientV2 = { ...client, name: "V2" };

    const msgV1: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payloadV1,
    };

    const msgV3: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      version: 3,
      type: "ClientPurposeAdded",
      data: { client: clientV3 } as ClientPurposeAddedV2,
    };

    const msgV2: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      version: 2,
      type: "ClientPurposeAdded",
      data: { client: clientV2 } as ClientPurposeAddedV2,
    };

    await handleAuthorizationEventMessageV2([msgV1], dbContext);
    await handleAuthorizationEventMessageV2([msgV3], dbContext);
    await handleAuthorizationEventMessageV2([msgV2], dbContext);

    const stored = await getOneFromDb(dbContext, ClientDbTable.client, {
      id: client.id,
    });

    expect(stored.name).toBe("V3");
    expect(stored.metadataVersion).toBe(3);
  });
});
