/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  CorrelationId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  TenantNotificationConfigId,
  toProducerKeychainV2,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "ts-pattern";
import { handleProducerKeychainUserDeleted } from "../src/handlers/authorization/handleProducerKeychainUserDeleted.js";
import { tenantNotFound } from "../src/models/errors.js";
import {
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleProducerKeychainUserDeleted", async () => {
  const producerId = generateId<TenantId>();
  const producerKeychainId = generateId<ProducerKeychainId>();
  const userId1 = generateId<UserId>();
  const userId2 = generateId<UserId>();
  const userId3 = generateId<UserId>();

  const producerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain({ producerId }),
    id: producerKeychainId,
    name: "Test Producer Keychain",
    users: [userId1, userId2, userId3],
  };

  const producerTenant = getMockTenant(producerId);
  const users = [
    getMockUser(producerTenant.id, userId1),
    getMockUser(producerTenant.id, userId2),
    getMockUser(producerTenant.id, userId3),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneTenant(producerTenant);
    for (const user of users) {
      await addOneUser(user);
    }
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: producerTenant.id,
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

  it("should throw missingKafkaMessageDataError when producerKeychain is undefined", async () => {
    await expect(() =>
      handleProducerKeychainUserDeleted({
        producerKeychainV2Msg: undefined,
        userId: userId1,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "producerKeychain",
        "ProducerKeychainUserDeleted"
      )
    );
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const unknownProducerId = generateId<TenantId>();

    const producerKeychainUnknownProducer: ProducerKeychain = {
      ...getMockProducerKeychain({ producerId }),
      producerId: unknownProducerId,
      name: "Test Producer Keychain",
      users: [userId1, userId2, userId3],
    };

    await expect(() =>
      handleProducerKeychainUserDeleted({
        producerKeychainV2Msg: toProducerKeychainV2(
          producerKeychainUnknownProducer
        ),
        userId: userId1,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerId));
  });

  it("should generate one message per user of the tenant except the user that deleted the key", async () => {
    const messages = await handleProducerKeychainUserDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychain),
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

    const messages = await handleProducerKeychainUserDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychain),
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
    const messages = await handleProducerKeychainUserDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychain),
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
          expect(message.email.body).toContain(producerTenant.name);
        })
        .exhaustive();
      expect(message.email.body).toContain(producerKeychain.name);
    });
  });
});
