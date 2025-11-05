import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockContext,
  getMockProducerKeychain,
  getMockKey,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  ProducerKeychainId,
  UserId,
  AuthorizationEventEnvelopeV2,
  toProducerKeychainV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { handleProducerKeychainKeyAddedDeletedToClientUsers } from "../src/handlers/authorizations/handleProducerKeychainKeyAddedDeletedToClientUsers.js";
import { producerKeychainKeyNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { addOneTenant, readModelService } from "./utils.js";

describe("handleProducerKeychainKeyAddedDeletedToClientUsers", () => {
  const producerId = generateId<TenantId>();
  const producerKeychainId = generateId<ProducerKeychainId>();
  const userId1 = generateId<UserId>();
  const userId2 = generateId<UserId>();
  const userId3 = generateId<UserId>();

  const key1 = {
    ...getMockKey(),
    userId: userId1,
    kid: "key1-kid",
  };

  const key2 = {
    ...getMockKey(),
    userId: userId2,
    kid: "key2-kid",
  };

  const producerKeychain = {
    ...getMockProducerKeychain({ producerId }),
    id: producerKeychainId,
    name: "Test Producer Keychain",
    keys: [key1, key2],
    users: [userId1, userId2, userId3],
  };

  const producerTenant = getMockTenant(producerId);

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    // Setup test data
    await addOneTenant(producerTenant);
  });

  describe("Error cases", () => {
    it("should throw missingKafkaMessageDataError when producerKeychain is missing", async () => {
      const messageWithMissingData: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          kid: "test-kid",
          // producerKeychain is intentionally missing to test the error case
        },
      };

      await expect(() =>
        handleProducerKeychainKeyAddedDeletedToClientUsers(
          messageWithMissingData,
          logger,
          readModelService
        )
      ).rejects.toThrow(
        missingKafkaMessageDataError(
          "producerKeychain",
          "ProducerKeychainKeyAdded"
        )
      );
    });

    it("should throw producerKeychainKeyNotFound when key is not found in ProducerKeychainKeyDeleted event", async () => {
      const unknownKid = "unknown-kid";
      const messageWithUnknownKey: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: unknownKid,
        },
      };

      // Mock notification recipients so the check doesn't exit early
      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId1, tenantId: producerId },
        { userId: userId2, tenantId: producerId },
      ]);

      await expect(() =>
        handleProducerKeychainKeyAddedDeletedToClientUsers(
          messageWithUnknownKey,
          logger,
          readModelService
        )
      ).rejects.toThrow(
        producerKeychainKeyNotFound(producerKeychainId, unknownKid)
      );
    });
  });

  describe("Empty notifications scenario", () => {
    it("should return empty array when no users have notifications enabled", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      expect(notifications).toEqual([]);
    });
  });

  describe("ProducerKeychainKeyAdded event", () => {
    it("should generate notifications for all users when a key is added", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid,
        },
      };

      const userNotificationConfigs = [
        { userId: userId1, tenantId: producerId },
        { userId: userId2, tenantId: producerId },
        { userId: userId3, tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      expect(notifications).toHaveLength(userNotificationConfigs.length);

      const expectedBody = inAppTemplates.producerKeychainKeyAddedToClientUsers(
        producerKeychain.name
      );

      const expectedNotifications = userNotificationConfigs.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "producerKeychainKeyAddedDeletedToClientUsers",
        entityId: producerKeychain.id,
      }));

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    });

    it("should generate notifications for multiple users", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid,
        },
      };

      const users = [
        { userId: userId1, tenantId: producerId },
        { userId: userId2, tenantId: producerId },
        { userId: userId3, tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      expect(notifications).toHaveLength(3);

      // Check that all users got notifications
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(users[0].userId);
      expect(userIds).toContain(users[1].userId);
      expect(userIds).toContain(users[2].userId);
    });
  });

  describe("ProducerKeychainKeyDeleted event", () => {
    it("should generate notifications for all users except the key owner", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid, // key1 belongs to userId1
        },
      };

      const userNotificationConfigs = [
        { userId: userId1, tenantId: producerId }, // This user should be filtered out
        { userId: userId2, tenantId: producerId },
        { userId: userId3, tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      // Should exclude the key owner (userId1)
      expect(notifications).toHaveLength(2);

      const expectedBody =
        inAppTemplates.producerKeychainKeyDeletedToClientUsers(
          producerKeychain.name,
          key1.userId
        );

      const expectedNotifications = [
        {
          userId: userId2,
          tenantId: producerId,
          body: expectedBody,
          notificationType: "producerKeychainKeyAddedDeletedToClientUsers",
          entityId: producerKeychain.id,
        },
        {
          userId: userId3,
          tenantId: producerId,
          body: expectedBody,
          notificationType: "producerKeychainKeyAddedDeletedToClientUsers",
          entityId: producerKeychain.id,
        },
      ];

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );

      // Verify the key owner is not included
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).not.toContain(userId1);
    });

    it("should handle case where key owner is not in notification configs", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid, // key1 belongs to userId1
        },
      };

      // userId1 (key owner) is not in the notification configs
      const userNotificationConfigs = [
        { userId: userId2, tenantId: producerId },
        { userId: userId3, tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      // Should include all users since key owner wasn't in the list anyway
      expect(notifications).toHaveLength(2);

      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(userId2);
      expect(userIds).toContain(userId3);
    });
  });

  describe("ProducerKeychainUserDeleted event", () => {
    it("should generate notifications for all users except the deleted user", async () => {
      const deletedUserId = userId1;
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          userId: deletedUserId,
        },
      };

      const userNotificationConfigs = [
        { userId: userId1, tenantId: producerId }, // This user should be filtered out
        { userId: userId2, tenantId: producerId },
        { userId: userId3, tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      // Should exclude the deleted user (userId1)
      expect(notifications).toHaveLength(2);

      const expectedBody =
        inAppTemplates.producerKeychainUserDeletedToClientUsers(
          producerKeychain.name
        );

      const expectedNotifications = [
        {
          userId: userId2,
          tenantId: producerId,
          body: expectedBody,
          notificationType: "producerKeychainKeyAddedDeletedToClientUsers",
          entityId: producerKeychain.id,
        },
        {
          userId: userId3,
          tenantId: producerId,
          body: expectedBody,
          notificationType: "producerKeychainKeyAddedDeletedToClientUsers",
          entityId: producerKeychain.id,
        },
      ];

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );

      // Verify the deleted user is not included
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).not.toContain(deletedUserId);
    });

    it("should handle case where deleted user is not in notification configs", async () => {
      const deletedUserId = userId1;
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          userId: deletedUserId,
        },
      };

      // userId1 (deleted user) is not in the notification configs
      const userNotificationConfigs = [
        { userId: userId2, tenantId: producerId },
        { userId: userId3, tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      // Should include all users since deleted user wasn't in the list anyway
      expect(notifications).toHaveLength(2);

      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(userId2);
      expect(userIds).toContain(userId3);
    });

    it("should return empty array when only the deleted user had notifications enabled", async () => {
      const deletedUserId = userId1;
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          userId: deletedUserId,
        },
      };

      // Only the deleted user has notifications enabled
      const userNotificationConfigs = [
        { userId: deletedUserId, tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      expect(notifications).toEqual([]);
    });
  });

  describe("Notification content validation", () => {
    it("should use correct template for ProducerKeychainKeyAdded", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId1, tenantId: producerId },
      ]);

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      expect(notifications[0].body).toBe(
        inAppTemplates.producerKeychainKeyAddedToClientUsers(
          producerKeychain.name
        )
      );
    });

    it("should use correct template for ProducerKeychainKeyDeleted", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId2, tenantId: producerId },
      ]); // Different user than key owner

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      expect(notifications[0].body).toBe(
        inAppTemplates.producerKeychainKeyDeletedToClientUsers(
          producerKeychain.name,
          key1.userId
        )
      );
    });

    it("should use correct template for ProducerKeychainUserDeleted", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          userId: userId1,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId2, tenantId: producerId },
      ]); // Different user than deleted user

      const notifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          message,
          logger,
          readModelService
        );

      expect(notifications[0].body).toBe(
        inAppTemplates.producerKeychainUserDeletedToClientUsers(
          producerKeychain.name
        )
      );
    });
  });

  describe("Notification type and entity validation", () => {
    it("should set correct notificationType and entityId for all event types", async () => {
      // Test ProducerKeychainKeyAdded
      const keyAddedMessage: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId1, tenantId: producerId },
      ]);

      const keyAddedNotifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          keyAddedMessage,
          logger,
          readModelService
        );

      expect(keyAddedNotifications).toHaveLength(1);
      expect(keyAddedNotifications[0].notificationType).toBe(
        "producerKeychainKeyAddedDeletedToClientUsers"
      );
      expect(keyAddedNotifications[0].entityId).toBe(producerKeychain.id);
      expect(keyAddedNotifications[0].userId).toBe(userId1);
      expect(keyAddedNotifications[0].tenantId).toBe(producerId);

      // Test ProducerKeychainKeyDeleted
      const keyDeletedMessage: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          kid: key1.kid,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId2, tenantId: producerId },
      ]); // Different user than key owner

      const keyDeletedNotifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          keyDeletedMessage,
          logger,
          readModelService
        );

      expect(keyDeletedNotifications).toHaveLength(1);
      expect(keyDeletedNotifications[0].notificationType).toBe(
        "producerKeychainKeyAddedDeletedToClientUsers"
      );
      expect(keyDeletedNotifications[0].entityId).toBe(producerKeychain.id);
      expect(keyDeletedNotifications[0].userId).toBe(userId2);
      expect(keyDeletedNotifications[0].tenantId).toBe(producerId);

      // Test ProducerKeychainUserDeleted
      const userDeletedMessage: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychain),
          userId: userId1,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId2, tenantId: producerId },
      ]); // Different user than deleted user

      const userDeletedNotifications =
        await handleProducerKeychainKeyAddedDeletedToClientUsers(
          userDeletedMessage,
          logger,
          readModelService
        );

      expect(userDeletedNotifications).toHaveLength(1);
      expect(userDeletedNotifications[0].notificationType).toBe(
        "producerKeychainKeyAddedDeletedToClientUsers"
      );
      expect(userDeletedNotifications[0].entityId).toBe(producerKeychain.id);
      expect(userDeletedNotifications[0].userId).toBe(userId2);
      expect(userDeletedNotifications[0].tenantId).toBe(producerId);
    });
  });
});
