/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockEService,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import {
  AuthorizationEventEnvelopeV2,
  EService,
  EServiceId,
  generateId,
  Key,
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  toProducerKeychainV2,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi, Mock } from "vitest";
import { handleAuthorizationEvent } from "../src/handlers/authorizations/handleAuthorizationEvent.js";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { readModelService } from "./utils.js";

describe("handleAuthorizationEvent", () => {
  const producerId = generateId<TenantId>();
  const producerKeychainId = generateId<ProducerKeychainId>();
  const userId1 = generateId<UserId>();
  const userId2 = generateId<UserId>();
  const userId3 = generateId<UserId>();
  const eserviceId = generateId<EServiceId>();

  const key1: Key = {
    ...getMockKey(),
    userId: userId1,
    kid: "key1-kid",
  };

  const producerKeychainAfterDeletion: ProducerKeychain = {
    ...getMockProducerKeychain({ producerId }),
    id: producerKeychainId,
    name: "Test Producer Keychain",
    keys: [],
    users: [userId1, userId2, userId3],
    eservices: [eserviceId],
  };

  const asyncEservice: EService = {
    ...getMockEService(eserviceId, producerId),
    asyncExchange: true,
    name: "Async EService 1",
  };

  const { logger } = getMockContext({});
  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  const decodedMessage: AuthorizationEventEnvelopeV2 = {
    type: "ProducerKeychainKeyDeleted",
    event_version: 2,
    sequence_num: 1,
    version: 1,
    stream_id: generateId(),
    log_date: new Date(),
    data: {
      producerKeychain: toProducerKeychainV2(producerKeychainAfterDeletion),
      kid: key1.kid,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetNotificationRecipients.mockReset();
    readModelService.getEServiceById = vi.fn().mockResolvedValue(asyncEservice);
    readModelService.eserviceExistsInOtherProducerKeychains = vi
      .fn()
      .mockResolvedValue(false);
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: userId1, tenantId: producerId },
      { userId: userId2, tenantId: producerId },
      { userId: userId3, tenantId: producerId },
    ]);
  });

  it("should return both existing and async-eservice notifications for ProducerKeychainKeyDeleted", async () => {
    const notifications = await handleAuthorizationEvent(
      decodedMessage,
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(6);

    const keyDeletedBody =
      inAppTemplates.producerKeychainKeyDeletedToClientUsers(
        producerKeychainAfterDeletion.name,
        key1.kid
      );
    const noKeysAsyncEserviceBody =
      inAppTemplates.producerKeychainNoKeysForAsyncEserviceToProducerUsers(
        producerKeychainAfterDeletion.name,
        asyncEservice.name
      );

    const keyDeletedNotifications = notifications.filter(
      (notification) => notification.body === keyDeletedBody
    );
    const noKeysAsyncEserviceNotifications = notifications.filter(
      (notification) => notification.body === noKeysAsyncEserviceBody
    );

    expect(keyDeletedNotifications).toHaveLength(3);
    expect(noKeysAsyncEserviceNotifications).toHaveLength(3);

    keyDeletedNotifications.forEach((notification) => {
      expect(notification.tenantId).toBe(producerId);
      expect(notification.entityId).toBe(producerKeychainId);
    });

    noKeysAsyncEserviceNotifications.forEach((notification) => {
      expect(notification.tenantId).toBe(producerId);
      expect(notification.entityId).toBe(producerKeychainId);
    });
  });

  it("should use producerKeychainId as entityId for ProducerKeychainEServiceRemoved", async () => {
    const decodedMessage: AuthorizationEventEnvelopeV2 = {
      type: "ProducerKeychainEServiceRemoved",
      event_version: 2,
      sequence_num: 1,
      version: 1,
      stream_id: generateId(),
      log_date: new Date(),
      data: {
        producerKeychain: toProducerKeychainV2(producerKeychainAfterDeletion),
        eserviceId,
      },
    };

    const notifications = await handleAuthorizationEvent(
      decodedMessage,
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(3);
    notifications.forEach((notification) => {
      expect(notification.tenantId).toBe(producerId);
      expect(notification.entityId).toBe(producerKeychainId);
      expect(notification.notificationType).toBe(
        "producerKeychainKeyAddedDeletedToClientUsers"
      );
    });
  });
});
