import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockContext,
  getMockClient,
  getMockKey,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  ClientId,
  UserId,
  AuthorizationEventEnvelopeV2,
  toClientV2,
} from "pagopa-interop-models";
import { handleClientKeyAddedDeletedToClientUsers } from "../src/handlers/authorizations/handleClientKeyAddedDeletedToClientUsers.js";
import { clientKeyNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { addOneTenant, readModelService } from "./utils.js";

describe("handleClientKeyAddedDeletedToClientUsers", () => {
  const consumerId = generateId<TenantId>();
  const clientId = generateId<ClientId>();
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

  const client = {
    ...getMockClient({
      consumerId,
      users: [userId1, userId2, userId3],
      keys: [key1, key2],
    }),
    id: clientId,
    name: "Test Client",
  };

  const consumerTenant = getMockTenant(consumerId);

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    // Setup test data
    await addOneTenant(consumerTenant);
  });

  describe("Error cases", () => {
    it("should throw clientKeyNotFound when key is not found in ClientKeyDeleted event", async () => {
      const unknownKid = "unknown-kid";
      const messageWithUnknownKey: AuthorizationEventEnvelopeV2 = {
        type: "ClientKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          kid: unknownKid,
        },
      };

      // Mock notification recipients so the check doesn't exit early
      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId1, tenantId: consumerId },
        { userId: userId2, tenantId: consumerId },
      ]);

      await expect(() =>
        handleClientKeyAddedDeletedToClientUsers(
          messageWithUnknownKey,
          logger,
          readModelService
        )
      ).rejects.toThrow(clientKeyNotFound(clientId, unknownKid));
    });
  });

  describe("Empty notifications scenario", () => {
    it("should return empty array when no users have notifications enabled", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ClientKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          kid: key1.kid,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
        message,
        logger,
        readModelService
      );

      expect(notifications).toEqual([]);
    });
  });

  describe("ClientKeyAdded event", () => {
    it("should generate notifications for all users when a key is added", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ClientKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          kid: key1.kid,
        },
      };

      const userNotificationConfigs = [
        { userId: userId1, tenantId: consumerId },
        { userId: userId2, tenantId: consumerId },
        { userId: userId3, tenantId: consumerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
        message,
        logger,
        readModelService
      );

      expect(notifications).toHaveLength(userNotificationConfigs.length);

      const expectedBody = inAppTemplates.clientKeyAddedToClientUsers(
        client.name
      );

      const expectedNotifications = userNotificationConfigs.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "clientKeyAddedDeletedToClientUsers",
        entityId: client.id,
      }));

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    });

    it("should generate notifications for multiple users", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ClientKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          kid: key1.kid,
        },
      };

      const users = [
        { userId: userId1, tenantId: consumerId },
        { userId: userId2, tenantId: consumerId },
        { userId: userId3, tenantId: consumerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
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

  describe("ClientKeyDeleted event", () => {
    it("should generate notifications for all users except the key owner", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ClientKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          kid: key1.kid, // key1 belongs to userId1
        },
      };

      const userNotificationConfigs = [
        { userId: userId1, tenantId: consumerId }, // This user should be filtered out
        { userId: userId2, tenantId: consumerId },
        { userId: userId3, tenantId: consumerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
        message,
        logger,
        readModelService
      );

      // Should exclude the key owner (userId1)
      expect(notifications).toHaveLength(2);

      const expectedBody = inAppTemplates.clientKeyDeletedToClientUsers(
        client.name,
        key1.userId,
        key1.kid
      );

      const expectedNotifications = [
        {
          userId: userId2,
          tenantId: consumerId,
          body: expectedBody,
          notificationType: "clientKeyAddedDeletedToClientUsers",
          entityId: client.id,
        },
        {
          userId: userId3,
          tenantId: consumerId,
          body: expectedBody,
          notificationType: "clientKeyAddedDeletedToClientUsers",
          entityId: client.id,
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
        type: "ClientKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          kid: key1.kid, // key1 belongs to userId1
        },
      };

      // userId1 (key owner) is not in the notification configs
      const userNotificationConfigs = [
        { userId: userId2, tenantId: consumerId },
        { userId: userId3, tenantId: consumerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
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

  describe("ClientUserDeleted event", () => {
    it("should generate notifications for all users except the deleted user", async () => {
      const deletedUserId = userId1;
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ClientUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          userId: deletedUserId,
        },
      };

      const userNotificationConfigs = [
        { userId: userId1, tenantId: consumerId }, // This user should be filtered out
        { userId: userId2, tenantId: consumerId },
        { userId: userId3, tenantId: consumerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
        message,
        logger,
        readModelService
      );

      // Should exclude the deleted user (userId1)
      expect(notifications).toHaveLength(2);

      const expectedBody = inAppTemplates.clientUserDeletedToClientUsers(
        client.name
      );

      const expectedNotifications = [
        {
          userId: userId2,
          tenantId: consumerId,
          body: expectedBody,
          notificationType: "clientKeyAddedDeletedToClientUsers",
          entityId: client.id,
        },
        {
          userId: userId3,
          tenantId: consumerId,
          body: expectedBody,
          notificationType: "clientKeyAddedDeletedToClientUsers",
          entityId: client.id,
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
        type: "ClientUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          userId: deletedUserId,
        },
      };

      // userId1 (deleted user) is not in the notification configs
      const userNotificationConfigs = [
        { userId: userId2, tenantId: consumerId },
        { userId: userId3, tenantId: consumerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
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
        type: "ClientUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          userId: deletedUserId,
        },
      };

      // Only the deleted user has notifications enabled
      const userNotificationConfigs = [
        { userId: deletedUserId, tenantId: consumerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
        message,
        logger,
        readModelService
      );

      expect(notifications).toEqual([]);
    });
  });

  describe("Notification content validation", () => {
    it("should use correct template for ClientKeyAdded", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ClientKeyAdded",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          kid: key1.kid,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId1, tenantId: consumerId },
      ]);

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
        message,
        logger,
        readModelService
      );

      expect(notifications[0].body).toBe(
        inAppTemplates.clientKeyAddedToClientUsers(client.name)
      );
    });

    it("should use correct template for ClientKeyDeleted", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ClientKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          kid: key1.kid,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId2, tenantId: consumerId },
      ]); // Different user than key owner

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
        message,
        logger,
        readModelService
      );

      expect(notifications[0].body).toBe(
        inAppTemplates.clientKeyDeletedToClientUsers(
          client.name,
          key1.userId,
          key1.kid
        )
      );
    });

    it("should use correct template for ClientUserDeleted", async () => {
      const message: AuthorizationEventEnvelopeV2 = {
        type: "ClientUserDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          client: toClientV2(client),
          userId: userId1,
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId2, tenantId: consumerId },
      ]); // Different user than deleted user

      const notifications = await handleClientKeyAddedDeletedToClientUsers(
        message,
        logger,
        readModelService
      );

      expect(notifications[0].body).toBe(
        inAppTemplates.clientUserDeletedToClientUsers(client.name)
      );
    });
  });
});
