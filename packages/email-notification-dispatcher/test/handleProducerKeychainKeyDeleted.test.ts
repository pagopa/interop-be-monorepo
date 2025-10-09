/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockKey,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
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
import { handleProducerKeychainKeyDeleted } from "../src/handlers/authorization/handleProducerKeychainKeyDeleted.js";
import {
  producerKeychainKeyNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import {
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
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

  const producerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain({ producerId }),
    id: producerKeychainId,
    name: "Test Producer Keychain",
    keys: [key1, key2],
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
          .map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw missingKafkaMessageDataError when producerKeychain is undefined", async () => {
    await expect(() =>
      handleProducerKeychainKeyDeleted({
        producerKeychainV2Msg: undefined,
        kid: key1.kid,
        logger,
        templateService,
        userService,
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
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerId));
  });

  it("should throw producerKeychainKeyNotFound when key is not found", async () => {
    const unknownKid = "unknown";

    await expect(() =>
      handleProducerKeychainKeyDeleted({
        producerKeychainV2Msg: toProducerKeychainV2(producerKeychain),
        kid: unknownKid,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      producerKeychainKeyNotFound(producerKeychainId, unknownKid)
    );
  });

  it("should generate one message per user of the tenant except the user that deleted the key", async () => {
    const messages = await handleProducerKeychainKeyDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychain),
      kid: key1.kid,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      false
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[2].email)).toBe(
      true
    );
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        { userId: users[2].id, tenantId: users[2].tenantId },
      ]);

    const messages = await handleProducerKeychainKeyDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychain),
      kid: key1.kid,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      false
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      false
    );
    expect(messages.some((message) => message.address === users[2].email)).toBe(
      true
    );
  });

  it("should generate a complete and correct message", async () => {
    const messages = await handleProducerKeychainKeyDeleted({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychain),
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
        `Una chiave di e-service è stata rimossa`
      );
      expect(message.email.body).toContain(producerTenant.name);
      expect(message.email.body).toContain(key1.userId);
      expect(message.email.body).toContain(producerKeychain.name);
    });
  });
});
