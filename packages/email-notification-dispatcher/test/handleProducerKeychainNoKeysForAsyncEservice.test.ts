/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockKey,
  getMockProducerKeychain,
  getMockTenant,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  CorrelationId,
  EService,
  EServiceId,
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
import { handleProducerKeychainNoKeysForAsyncEservice } from "../src/handlers/authorization/handleProducerKeychainNoKeysForAsyncEservice.js";
import {
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleProducerKeychainNoKeysForAsyncEservice", async () => {
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

  const eserviceId1 = generateId<EServiceId>();
  const eserviceId2 = generateId<EServiceId>();

  const asyncEservice: EService = {
    ...getMockEService(eserviceId1, producerId),
    asyncExchange: true,
    name: "Async EService 1",
    descriptors: [
      {
        ...getMockDescriptor(),
      },
    ],
  };

  const syncEservice: EService = {
    ...getMockEService(eserviceId2, producerId),
    asyncExchange: false,
    name: "Sync EService 1",
    descriptors: [
      {
        ...getMockDescriptor(),
      },
    ],
  };

  const producerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain({ producerId }),
    id: producerKeychainId,
    name: "Test Producer Keychain",
    keys: [key1, key2],
    users: [userId1, userId2, userId3],
    eservices: [eserviceId1],
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
            userRoles: [authRole.ADMIN_ROLE],
          }))
      );
  });

  it("should throw missingKafkaMessageDataError when producerKeychain is undefined", async () => {
    await expect(() =>
      handleProducerKeychainNoKeysForAsyncEservice({
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

  it("should return empty array when keychain still has keys", async () => {
    const producerKeychainWithKeys: ProducerKeychain = {
      ...producerKeychain,
      keys: [key1, key2],
      eservices: [eserviceId1],
    };

    const messages = await handleProducerKeychainNoKeysForAsyncEservice({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychainWithKeys),
      kid: "some-kid",
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages).toEqual([]);
  });

  it("should return empty array when keychain has no keys but no async e-services", async () => {
    const producerKeychainWithNoKeys: ProducerKeychain = {
      ...producerKeychain,
      keys: [],
      eservices: [eserviceId2],
    };

    readModelService.getEServiceById = vi
      .fn()
      .mockResolvedValueOnce(syncEservice);

    const messages = await handleProducerKeychainNoKeysForAsyncEservice({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychainWithNoKeys),
      kid: "some-kid",
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages).toEqual([]);
  });

  it("should send email notifications when keychain has no keys and has async e-services", async () => {
    const producerKeychainWithNoKeys: ProducerKeychain = {
      ...producerKeychain,
      keys: [],
      eservices: [eserviceId1],
    };

    readModelService.getEServiceById = vi
      .fn()
      .mockResolvedValueOnce(asyncEservice);

    const messages = await handleProducerKeychainNoKeysForAsyncEservice({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychainWithNoKeys),
      kid: "some-kid",
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBeGreaterThan(0);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(asyncEservice.name);
      expect(message.email.body).toContain(producerKeychain.name);
    });
  });

  it("should include correct email subject", async () => {
    const producerKeychainWithNoKeys: ProducerKeychain = {
      ...producerKeychain,
      keys: [],
      eservices: [eserviceId1],
    };

    readModelService.getEServiceById = vi
      .fn()
      .mockResolvedValueOnce(asyncEservice);

    const messages = await handleProducerKeychainNoKeysForAsyncEservice({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychainWithNoKeys),
      kid: "some-kid",
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBeGreaterThan(0);
    messages.forEach((message) => {
      expect(message.email.subject).toContain(producerKeychain.name);
      expect(message.email.subject).toContain(
        "senza chiavi per e-service asincroni"
      );
    });
  });

  it("should include multiple async e-service names in the email body", async () => {
    const eserviceId3 = generateId<EServiceId>();
    const asyncEservice2: EService = {
      ...getMockEService(eserviceId3, producerId),
      asyncExchange: true,
      name: "Async EService 2",
      descriptors: [
        {
          ...getMockDescriptor(),
        },
      ],
    };

    const producerKeychainWithNoKeys: ProducerKeychain = {
      ...producerKeychain,
      keys: [],
      eservices: [eserviceId1, eserviceId2, eserviceId3],
    };

    readModelService.getEServiceById = vi
      .fn()
      .mockResolvedValueOnce(asyncEservice)
      .mockResolvedValueOnce(syncEservice)
      .mockResolvedValueOnce(asyncEservice2);

    const messages = await handleProducerKeychainNoKeysForAsyncEservice({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychainWithNoKeys),
      kid: "some-kid",
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBeGreaterThan(0);
    messages.forEach((message) => {
      expect(message.email.body).toContain(asyncEservice.name);
      expect(message.email.body).toContain(asyncEservice2.name);
    });
  });

  it("should return empty array when no users have notifications enabled", async () => {
    const producerKeychainWithNoKeys: ProducerKeychain = {
      ...producerKeychain,
      keys: [],
      eservices: [eserviceId1],
    };

    readModelService.getEServiceById = vi
      .fn()
      .mockResolvedValueOnce(asyncEservice);

    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const messages = await handleProducerKeychainNoKeysForAsyncEservice({
      producerKeychainV2Msg: toProducerKeychainV2(producerKeychainWithNoKeys),
      kid: "some-kid",
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages).toEqual([]);
  });
});
