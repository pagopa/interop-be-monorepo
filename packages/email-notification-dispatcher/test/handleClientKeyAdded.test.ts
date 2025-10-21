/* eslint-disable functional/immutable-data */
import {
  getMockClient,
  getMockContext,
  getMockKey,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import {
  Client,
  ClientId,
  CorrelationId,
  generateId,
  Key,
  missingKafkaMessageDataError,
  NotificationType,
  TenantId,
  TenantNotificationConfigId,
  toClientV2,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "ts-pattern";
import { handleClientKeyAdded } from "../src/handlers/authorization/handleClientKeyAdded.js";
import { clientKeyNotFound, tenantNotFound } from "../src/models/errors.js";
import {
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleClientKeyAdded", async () => {
  const consumerId = generateId<TenantId>();
  const clientId = generateId<ClientId>();
  const userId1 = generateId<UserId>();
  const userId2 = generateId<UserId>();
  const userId3 = generateId<UserId>();

  const key1: Key = {
    ...getMockKey(),
    userId: userId1,
    kid: "key1-kid",
  };

  const key2: Key = {
    ...getMockKey(),
    userId: userId2,
    kid: "key2-kid",
  };

  const client: Client = {
    ...getMockClient({
      consumerId,
      users: [userId1, userId2, userId3],
      keys: [key1, key2],
    }),
    id: clientId,
    name: "Test Client",
  };

  const consumerTenant = getMockTenant(consumerId);
  const users = [
    getMockUser(consumerTenant.id, userId1),
    getMockUser(consumerTenant.id, userId2),
    getMockUser(consumerTenant.id, userId3),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneTenant(consumerTenant);
    for (const user of users) {
      await addOneUser(user);
    }
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: consumerTenant.id,
        enabled: true,
        createAt: new Date(),
      });
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockImplementation((tenantIds: TenantId[], _: NotificationType) =>
        users
          .filter((user) =>
            tenantIds.includes(unsafeBrandId<TenantId>(user.tenantId))
          )
          .map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw missingKafkaMessageDataError when client is undefined", async () => {
    await expect(() =>
      handleClientKeyAdded({
        clientV2Msg: undefined,
        kid: key1.kid,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(missingKafkaMessageDataError("client", "ClientKeyAdded"));
  });

  it("should throw tenantNotFound when consumer is not found", async () => {
    const unknownConsumerId = generateId<TenantId>();

    const clientUnknownProducer: Client = {
      ...getMockClient({
        consumerId: unknownConsumerId,
        users: [userId1, userId2, userId3],
        keys: [key1, key2],
      }),
      id: clientId,
      name: "Test Client",
    };

    await expect(() =>
      handleClientKeyAdded({
        clientV2Msg: toClientV2(clientUnknownProducer),
        kid: key1.kid,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownConsumerId));
  });

  it("should throw clientKeyNotFound when key is not found", async () => {
    const unknownKid = "unknown";

    await expect(() =>
      handleClientKeyAdded({
        clientV2Msg: toClientV2(client),
        kid: unknownKid,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(clientKeyNotFound(clientId, unknownKid));
  });

  it("should generate one message per user of the tenant except the user that added the key", async () => {
    const messages = await handleClientKeyAdded({
      clientV2Msg: toClientV2(client),
      kid: key1.kid,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(false);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[2].id
      )
    ).toBe(true);
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        { userId: users[2].id, tenantId: users[2].tenantId },
      ]);

    const messages = await handleClientKeyAdded({
      clientV2Msg: toClientV2(client),
      kid: key1.kid,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(false);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(false);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[2].id
      )
    ).toBe(true);
  });

  it("should generate a complete and correct message", async () => {
    const messages = await handleClientKeyAdded({
      clientV2Msg: toClientV2(client),
      kid: key1.kid,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(
        `Nuova chiave aggiunta al client &quot;${client.name}&quot;`
      );
      match(message.type)
        .with("User", () => {
          expect(message.email.body).toContain("{{ recipientName }}");
        })
        .with("Tenant", () => {
          expect(message.email.body).toContain(consumerTenant.name);
        })
        .exhaustive();
      expect(message.email.body).toContain(client.name);
    });
  });
});
