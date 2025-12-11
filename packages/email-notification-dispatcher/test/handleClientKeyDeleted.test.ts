/* eslint-disable functional/immutable-data */
import {
  getMockClient,
  getMockContext,
  getMockKey,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
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
import { handleClientKeyDeleted } from "../src/handlers/authorization/handleClientKeyDeleted.js";
import { tenantNotFound } from "../src/models/errors.js";
import {
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleClientKeyDeleted", async () => {
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

  const key3: Key = {
    ...getMockKey(),
    userId: userId3,
    kid: "key3-kid",
  };

  const client: Client = {
    ...getMockClient({
      consumerId,
      users: [userId1, userId2, userId3],
      keys: [key1, key2, key3],
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
          .map((user) => ({
            userId: user.id,
            tenantId: user.tenantId,
            // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
            userRoles: [authRole.ADMIN_ROLE],
          }))
      );
  });

  it("should throw missingKafkaMessageDataError when client is undefined", async () => {
    await expect(() =>
      handleClientKeyDeleted({
        clientV2Msg: undefined,
        kid: key1.kid,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("client", "ClientKeyDeleted")
    );
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
      handleClientKeyDeleted({
        clientV2Msg: toClientV2(clientUnknownProducer),
        kid: key1.kid,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownConsumerId));
  });

  it("should send notifications to remaining client users when a key is deleted", async () => {
    // key1 has been deleted, so client only has key2 and key3
    const clientAfterDeletion: Client = {
      ...client,
      users: [userId2, userId3],
      keys: [key2, key3],
    };

    const messages = await handleClientKeyDeleted({
      clientV2Msg: toClientV2(clientAfterDeletion),
      kid: key1.kid,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    // Should send to userId2 and userId3 (remaining client users), not userId1
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
    // key1 has been deleted, so client only has key2 and key3
    const clientAfterDeletion: Client = {
      ...client,
      keys: [key2, key3],
    };

    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        {
          userId: users[2].id,
          tenantId: users[2].tenantId,
          // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
          userRoles: [authRole.ADMIN_ROLE],
        },
      ]);

    const messages = await handleClientKeyDeleted({
      clientV2Msg: toClientV2(clientAfterDeletion),
      kid: key1.kid,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    // Only userId3 has notifications enabled and still is part of client users
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
    // key1 has been deleted, so client only has key2 and key3
    const clientAfterDeletion: Client = {
      ...client,
      users: [userId2, userId3],
      keys: [key2, key3],
    };

    const messages = await handleClientKeyDeleted({
      clientV2Msg: toClientV2(clientAfterDeletion),
      kid: key1.kid,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(
        `Una chiave di e-service è stata rimossa`
      );
      match(message.type)
        .with("User", () => {
          expect(message.email.body).toContain("{{ recipientName }}");
        })
        .with("Tenant", () => {
          expect(message.email.body).toContain(consumerTenant.name);
        })
        .exhaustive();
      expect(message.email.body).toContain(key1.kid);
      expect(message.email.body).toContain(client.name);
    });
  });
});
