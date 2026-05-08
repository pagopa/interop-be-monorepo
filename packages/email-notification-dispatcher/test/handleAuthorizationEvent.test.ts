/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockEService,
  getMockKey,
  getMockProducerKeychain,
  getMockTenantMail,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelope,
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  Key,
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  TenantNotificationConfigId,
  toProducerKeychainV2,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuthorizationEvent } from "../src/handlers/authorization/handleAuthorizationEvent.js";
import { readModelService, templateService } from "./utils.js";

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

  const producerTenant = {
    ...getMockTenant(producerId),
    mails: [getMockTenantMail()],
  };
  const { logger } = getMockContext({});
  const correlationId = generateId<CorrelationId>();

  const decodedMessage: AuthorizationEventEnvelope = {
    event_version: 2,
    type: "ProducerKeychainKeyDeleted",
    sequence_num: 1,
    stream_id: generateId(),
    version: 1,
    log_date: new Date(),
    data: {
      producerKeychain: toProducerKeychainV2(producerKeychainAfterDeletion),
      kid: key1.kid,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    readModelService.getTenantById = vi.fn().mockResolvedValue(producerTenant);
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: producerTenant.id,
        enabled: true,
        createAt: new Date(),
      });
    readModelService.getEServiceById = vi.fn().mockResolvedValue(asyncEservice);
    readModelService.eserviceExistsInOtherProducerKeychains = vi
      .fn()
      .mockResolvedValue(false);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        {
          userId: userId1,
          tenantId: producerId,
          userRoles: [authRole.ADMIN_ROLE],
        },
        {
          userId: userId2,
          tenantId: producerId,
          userRoles: [authRole.ADMIN_ROLE],
        },
        {
          userId: userId3,
          tenantId: producerId,
          userRoles: [authRole.ADMIN_ROLE],
        },
      ]);
  });

  it("should return both existing and async-eservice email notifications for ProducerKeychainKeyDeleted", async () => {
    const messages = await handleAuthorizationEvent({
      decodedMessage,
      logger,
      readModelService,
      templateService,
      correlationId,
    });

    expect(messages).toHaveLength(8);

    const keyDeletedMessages = messages.filter(
      (message) =>
        message.email.subject === "Una chiave di e-service è stata rimossa"
    );
    const noKeysAsyncEserviceMessages = messages.filter((message) =>
      message.email.subject.includes("senza chiavi per e-service asincroni")
    );

    expect(keyDeletedMessages).toHaveLength(4);
    expect(noKeysAsyncEserviceMessages).toHaveLength(4);

    keyDeletedMessages.forEach((message) => {
      expect(message.tenantId).toBe(producerId);
      expect(message.email.body).toContain(key1.kid);
      expect(message.email.body).toContain(producerKeychainAfterDeletion.name);
    });

    noKeysAsyncEserviceMessages.forEach((message) => {
      expect(message.tenantId).toBe(producerId);
      expect(message.email.body).toContain(asyncEservice.name);
      expect(message.email.body).toContain(producerKeychainAfterDeletion.name);
    });
  });

  it("should use producerKeychainId in email deep link for ProducerKeychainEServiceRemoved", async () => {
    const decodedMessage: AuthorizationEventEnvelope = {
      event_version: 2,
      type: "ProducerKeychainEServiceRemoved",
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      log_date: new Date(),
      data: {
        producerKeychain: toProducerKeychainV2(producerKeychainAfterDeletion),
        eserviceId,
      },
    };

    const messages = await handleAuthorizationEvent({
      decodedMessage,
      logger,
      readModelService,
      templateService,
      correlationId,
    });

    expect(messages).toHaveLength(4);
    messages.forEach((message) => {
      expect(message.tenantId).toBe(producerId);
      expect(message.email.body).toContain(
        `/emailDeepLink/producerKeychainKeyAddedDeletedToClientUsers/${producerKeychainId}`
      );
      expect(message.email.body).toContain("Visualizza portachiavi");
    });
  });
});
