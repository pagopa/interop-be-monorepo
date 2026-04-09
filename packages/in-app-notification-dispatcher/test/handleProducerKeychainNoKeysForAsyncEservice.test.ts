import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import {
  getMockContext,
  getMockProducerKeychain,
  getMockKey,
  getMockTenant,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  ProducerKeychainId,
  UserId,
  EServiceId,
  AuthorizationEventEnvelopeV2,
  toProducerKeychainV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { handleProducerKeychainNoKeysForAsyncEservice } from "../src/handlers/authorizations/handleProducerKeychainNoKeysForAsyncEservice.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { addOneTenant, readModelService } from "./utils.js";

describe("handleProducerKeychainNoKeysForAsyncEservice", () => {
  const producerId = generateId<TenantId>();
  const producerKeychainId = generateId<ProducerKeychainId>();
  const userId1 = generateId<UserId>();
  const userId2 = generateId<UserId>();

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

  const eserviceId1 = generateId<EServiceId>();
  const eserviceId2 = generateId<EServiceId>();

  const asyncEservice = {
    ...getMockEService(eserviceId1, producerId),
    asyncExchange: true,
    descriptors: [
      {
        ...getMockDescriptor(),
        eserviceId: eserviceId1,
      },
    ],
  };

  const syncEservice = {
    ...getMockEService(eserviceId2, producerId),
    asyncExchange: false,
    descriptors: [
      {
        ...getMockDescriptor(),
        eserviceId: eserviceId2,
      },
    ],
  };

  const producerTenant = getMockTenant(producerId);

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneTenant(producerTenant);
  });

  describe("Error cases", () => {
    it("should throw missingKafkaMessageDataError when producerKeychain is missing", async () => {
      const messageWithMissingData: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          kid: "test-kid",
        },
      };

      await expect(() =>
        handleProducerKeychainNoKeysForAsyncEservice(
          messageWithMissingData,
          logger,
          readModelService
        )
      ).rejects.toThrow(
        missingKafkaMessageDataError(
          "producerKeychain",
          "ProducerKeychainKeyDeleted"
        )
      );
    });
  });

  describe("Early return cases", () => {
    it("should return empty array when keychain still has keys", async () => {
      const producerKeychainWithKeys = {
        ...getMockProducerKeychain({ producerId }),
        id: producerKeychainId,
        name: "Test Producer Keychain",
        keys: [key1, key2],
        users: [userId1, userId2],
        eservices: [eserviceId1],
      };

      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychainWithKeys),
          kid: "deleted-key-kid",
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications = await handleProducerKeychainNoKeysForAsyncEservice(
        message,
        logger,
        readModelService
      );

      expect(notifications).toEqual([]);
      expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
    });

    it("should return empty array when keychain has no keys but no async e-services", async () => {
      const producerKeychainWithNoKeys = {
        ...getMockProducerKeychain({ producerId }),
        id: producerKeychainId,
        name: "Test Producer Keychain",
        keys: [],
        users: [userId1, userId2],
        eservices: [eserviceId2],
      };

      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychainWithNoKeys),
          kid: "deleted-key-kid",
        },
      };

      vi.spyOn(readModelService, "getEServiceById").mockResolvedValueOnce(
        syncEservice
      );

      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications = await handleProducerKeychainNoKeysForAsyncEservice(
        message,
        logger,
        readModelService
      );

      expect(notifications).toEqual([]);
    });

    it("should return empty array when keychain has no async e-services (empty eservices list)", async () => {
      const producerKeychainWithNoKeys = {
        ...getMockProducerKeychain({ producerId }),
        id: producerKeychainId,
        name: "Test Producer Keychain",
        keys: [],
        users: [userId1, userId2],
        eservices: [],
      };

      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychainWithNoKeys),
          kid: "deleted-key-kid",
        },
      };

      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications = await handleProducerKeychainNoKeysForAsyncEservice(
        message,
        logger,
        readModelService
      );

      expect(notifications).toEqual([]);
    });
  });

  describe("Notification generation", () => {
    it("should generate notifications when keychain has no keys and has async e-services", async () => {
      const producerKeychainWithNoKeys = {
        ...getMockProducerKeychain({ producerId }),
        id: producerKeychainId,
        name: "Test Keychain",
        keys: [],
        users: [userId1, userId2],
        eservices: [eserviceId1],
      };

      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychainWithNoKeys),
          kid: "deleted-key-kid",
        },
      };

      vi.spyOn(readModelService, "getEServiceById").mockResolvedValueOnce(
        asyncEservice
      );

      const userNotificationConfigs = [
        { userId: userId1, tenantId: producerId },
        { userId: userId2, tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(userNotificationConfigs);

      const notifications = await handleProducerKeychainNoKeysForAsyncEservice(
        message,
        logger,
        readModelService
      );

      expect(notifications).toHaveLength(2);

      const expectedBody =
        inAppTemplates.producerKeychainNoKeysForAsyncEserviceToProducerUsers(
          "Test Keychain",
          asyncEservice.name
        );

      notifications.forEach((notification) => {
        expect(notification.body).toBe(expectedBody);
        expect(notification.notificationType).toBe(
          "producerKeychainKeyAddedDeletedToClientUsers"
        );
        expect(notification.entityId).toBe(producerKeychainId);
      });
    });

    it("should include multiple async e-service names comma-separated", async () => {
      const eserviceId3 = generateId<EServiceId>();
      const asyncEservice2 = {
        ...getMockEService(eserviceId3, producerId),
        asyncExchange: true,
        name: "Async EService 2",
        descriptors: [
          {
            ...getMockDescriptor(),
            eserviceId: eserviceId3,
          },
        ],
      };

      const producerKeychainWithNoKeys = {
        ...getMockProducerKeychain({ producerId }),
        id: producerKeychainId,
        name: "Test Keychain",
        keys: [],
        users: [userId1],
        eservices: [eserviceId1, eserviceId2, eserviceId3],
      };

      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychainWithNoKeys),
          kid: "deleted-key-kid",
        },
      };

      vi.spyOn(readModelService, "getEServiceById")
        .mockResolvedValueOnce(asyncEservice)
        .mockResolvedValueOnce(syncEservice)
        .mockResolvedValueOnce(asyncEservice2);

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId1, tenantId: producerId },
      ]);

      const notifications = await handleProducerKeychainNoKeysForAsyncEservice(
        message,
        logger,
        readModelService
      );

      expect(notifications).toHaveLength(1);

      const expectedEserviceNames = [
        asyncEservice.name,
        asyncEservice2.name,
      ].join(", ");

      expect(notifications[0].body).toBe(
        inAppTemplates.producerKeychainNoKeysForAsyncEserviceToProducerUsers(
          "Test Keychain",
          expectedEserviceNames
        )
      );
    });

    it("should return empty array when no users have notifications enabled", async () => {
      const producerKeychainWithNoKeys = {
        ...getMockProducerKeychain({ producerId }),
        id: producerKeychainId,
        name: "Test Keychain",
        keys: [],
        users: [userId1],
        eservices: [eserviceId1],
      };

      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychainWithNoKeys),
          kid: "deleted-key-kid",
        },
      };

      vi.spyOn(readModelService, "getEServiceById").mockResolvedValueOnce(
        asyncEservice
      );

      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications = await handleProducerKeychainNoKeysForAsyncEservice(
        message,
        logger,
        readModelService
      );

      expect(notifications).toEqual([]);
    });

    it("should skip e-services that are not found in readmodel", async () => {
      const unknownEserviceId = generateId<EServiceId>();

      const producerKeychainWithNoKeys = {
        ...getMockProducerKeychain({ producerId }),
        id: producerKeychainId,
        name: "Test Keychain",
        keys: [],
        users: [userId1],
        eservices: [unknownEserviceId, eserviceId1],
      };

      const message: AuthorizationEventEnvelopeV2 = {
        type: "ProducerKeychainKeyDeleted",
        event_version: 2,
        sequence_num: 1,
        version: 1,
        stream_id: generateId(),
        log_date: new Date(),
        data: {
          producerKeychain: toProducerKeychainV2(producerKeychainWithNoKeys),
          kid: "deleted-key-kid",
        },
      };

      vi.spyOn(readModelService, "getEServiceById")
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(asyncEservice);

      mockGetNotificationRecipients.mockResolvedValue([
        { userId: userId1, tenantId: producerId },
      ]);

      const notifications = await handleProducerKeychainNoKeysForAsyncEservice(
        message,
        logger,
        readModelService
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].body).toContain(asyncEservice.name);
    });
  });
});
