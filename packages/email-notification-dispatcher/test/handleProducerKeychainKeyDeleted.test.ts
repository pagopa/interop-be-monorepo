/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockKey,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  CorrelationId,
  generateId,
  Key,
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
import { handleProducerKeychainKeyDeleted } from "../src/handlers/authorization/handleProducerKeychainKeyDeleted.js";
import { tenantNotFound } from "../src/models/errors.js";
import {
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleProducerKeychainKeyDeleted", async () => {
  const producerId = generateId<TenantId>();
  const producerKeychainId = generateId<ProducerKeychainId>();
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

  const producerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain({ producerId }),
    id: producerKeychainId,
    name: "Test Producer Keychain",
    keys: [key1, key2, key3],
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
      handleProducerKeychainKeyDeleted({
        producerKeychainV2Msg: undefined,
        kid: key1.kid,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "producerKeychain",
        "ProducerKeychainKeyDeleted"
      )
    );
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const unknownProducerId = generateId<TenantId>();

    const producerKeychainUnknownProducer: ProducerKeychain = {
      ...getMockProducerKeychain({ producerId }),
      producerId: unknownProducerId,
      name: "Test Producer Keychain",
      keys: [key1, key2],
      users: [userId1, userId2, userId3],
    };

    await expect(() =>
      handleProducerKeychainKeyDeleted({
        producerKeychainV2Msg: toProducerKeychainV2(
          producerKeychainUnknownProducer
        ),
        kid: key1.kid,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerId));
  });

  it("should send notifications to remaining key owners when a key is deleted", async () => {
    // key1 has been deleted, so producerKeychain only has key2 and key3
    const producerKeychainAfterDeletion: ProducerKeychain = {
      ...producerKeychain,
      keys: [key2, key3],
    };

    const messages = await handleProducerKeychainKeyDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(
        producerKeychainAfterDeletion
      ),
      kid: key1.kid,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    // Should send to userId2 and userId3 (remaining key owners), not userId1 (deleted key owner)
    expect(messages.length).toEqual(2);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(false); // userId1 - deleted key owner
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(true); // userId2 - remaining key owner
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[2].id
      )
    ).toBe(true); // userId3 - remaining key owner
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    // key1 has been deleted, so producerKeychain only has key2 and key3
    const producerKeychainAfterDeletion: ProducerKeychain = {
      ...producerKeychain,
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

    const messages = await handleProducerKeychainKeyDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(
        producerKeychainAfterDeletion
      ),
      kid: key1.kid,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    // Only userId3 has notifications enabled and still has a key
    expect(messages.length).toEqual(1);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(false); // userId1 - deleted key owner
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(false); // userId2 - notifications disabled
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[2].id
      )
    ).toBe(true); // userId3 - has notifications enabled and still has key3
  });

  it("should generate a complete and correct message", async () => {
    // key1 has been deleted, so producerKeychain only has key2 and key3
    const producerKeychainAfterDeletion: ProducerKeychain = {
      ...producerKeychain,
      keys: [key2, key3],
    };

    const messages = await handleProducerKeychainKeyDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(
        producerKeychainAfterDeletion
      ),
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
          expect(message.email.body).toContain(producerTenant.name);
        })
        .exhaustive();
      expect(message.email.body).toContain(key1.kid);
      expect(message.email.body).toContain(producerKeychain.name);
    });
  });
});
