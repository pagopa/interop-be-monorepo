/* eslint-disable functional/immutable-data */
import {
  getMockClient,
  getMockContext,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import {
  Client,
  ClientId,
  CorrelationId,
  generateId,
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
import { handleClientUserDeleted } from "../src/handlers/authorization/handleClientUserDeleted.js";
import { tenantNotFound } from "../src/models/errors.js";
import {
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleClientUserDeleted", async () => {
  const consumerId = generateId<TenantId>();
  const clientId = generateId<ClientId>();
  const userId1 = generateId<UserId>();
  const userId2 = generateId<UserId>();
  const userId3 = generateId<UserId>();

  const client: Client = {
    ...getMockClient({
      consumerId,
      users: [userId1, userId2, userId3],
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
      handleClientUserDeleted({
        clientV2Msg: undefined,
        userId: userId1,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("client", "ClientUserDeleted")
    );
  });

  it("should throw tenantNotFound when consumer is not found", async () => {
    const unknownConsumerId = generateId<TenantId>();

    const clientUnknownProducer: Client = {
      ...getMockClient({
        consumerId: unknownConsumerId,
        users: [userId1, userId2, userId3],
      }),
      id: clientId,
      name: "Test Client",
    };

    await expect(() =>
      handleClientUserDeleted({
        clientV2Msg: toClientV2(clientUnknownProducer),
        userId: userId1,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownConsumerId));
  });

  it("should generate one message per user of the tenant except the user that was deleted", async () => {
    const messages = await handleClientUserDeleted({
      clientV2Msg: toClientV2(client),
      userId: userId1,
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
        {
          userId: users[2].id,
          tenantId: users[2].tenantId,
          // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
          userRoles: [authRole.ADMIN_ROLE],
        },
      ]);

    const messages = await handleClientUserDeleted({
      clientV2Msg: toClientV2(client),
      userId: userId1,
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
    const messages = await handleClientUserDeleted({
      clientV2Msg: toClientV2(client),
      userId: userId1,
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
        `Attenzione: una chiave non è più sicura`
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
