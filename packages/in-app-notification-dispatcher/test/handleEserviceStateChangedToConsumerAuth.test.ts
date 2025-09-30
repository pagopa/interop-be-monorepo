import { describe, it, expect, vi } from "vitest";
import {
  getMockContext,
  getMockEService,
  getMockDescriptorPublished,
  getMockDocument,
  getMockTenant,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  generateId,
  TenantId,
  EServiceId,
} from "pagopa-interop-models";
import { handleEserviceStateChangedToConsumer } from "../src/handlers/authorizations/handleEserviceStateChangedToConsumer.js";
import { eserviceNotFound, tenantNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceStateChangedToConsumer (Authorization)", async () => {
  const eservice = {
    ...getMockEService(),
    producerId: generateId<TenantId>(),
    descriptors: [
      {
        ...getMockDescriptorPublished(),
        interface: getMockDocument(),
        docs: [getMockDocument()],
      },
    ],
  };
  const producer = getMockTenant(eservice.producerId);
  const { logger } = getMockContext({});

  await addOneEService(eservice);
  await addOneTenant(producer);

  it("should throw eserviceNotFound when eservice does not exist", async () => {
    const nonExistentEServiceId = generateId<EServiceId>();

    await expect(() =>
      handleEserviceStateChangedToConsumer(
        nonExistentEServiceId,
        logger,
        readModelService
      )
    ).rejects.toThrow(eserviceNotFound(nonExistentEServiceId));
  });

  it("should throw tenantNotFound when producer tenant does not exist", async () => {
    const eserviceWithNonExistentProducer = {
      ...getMockEService(),
      producerId: generateId<TenantId>(),
      descriptors: [
        {
          ...getMockDescriptorPublished(),
          interface: getMockDocument(),
          docs: [getMockDocument()],
        },
      ],
    };
    await addOneEService(eserviceWithNonExistentProducer);

    await expect(() =>
      handleEserviceStateChangedToConsumer(
        eserviceWithNonExistentProducer.id,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      tenantNotFound(eserviceWithNonExistentProducer.producerId)
    );
  });

  it("should return empty array when no agreements exist for the eservice", async () => {
    const eserviceWithoutAgreements = {
      ...getMockEService(),
      producerId: generateId<TenantId>(),
      descriptors: [
        {
          ...getMockDescriptorPublished(),
          interface: getMockDocument(),
          docs: [getMockDocument()],
        },
      ],
    };
    const producerWithoutAgreements = getMockTenant(
      eserviceWithoutAgreements.producerId
    );
    await addOneEService(eserviceWithoutAgreements);
    await addOneTenant(producerWithoutAgreements);

    const notifications = await handleEserviceStateChangedToConsumer(
      eserviceWithoutAgreements.id,
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
  });

  it("should throw tenantNotFound when consumer tenant is not found", async () => {
    const testEservice = {
      ...getMockEService(),
      producerId: generateId<TenantId>(),
      descriptors: [
        {
          ...getMockDescriptorPublished(),
          interface: getMockDocument(),
          docs: [getMockDocument()],
        },
      ],
    };
    const testProducer = getMockTenant(testEservice.producerId);
    await addOneEService(testEservice);
    await addOneTenant(testProducer);

    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      testEservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    await expect(() =>
      handleEserviceStateChangedToConsumer(
        testEservice.id,
        logger,
        readModelService
      )
    ).rejects.toThrow(tenantNotFound(consumerId));
  });

  it.each([
    { state: agreementState.pending, shouldNotify: true },
    { state: agreementState.active, shouldNotify: true },
    { state: agreementState.suspended, shouldNotify: true },
    { state: agreementState.archived, shouldNotify: false },
    { state: agreementState.missingCertifiedAttributes, shouldNotify: false },
    { state: agreementState.rejected, shouldNotify: false },
  ])(
    "should generate notifications for agreement in $state state (shouldNotify: $shouldNotify)",
    async ({ state, shouldNotify }) => {
      const testEservice = {
        ...getMockEService(),
        producerId: generateId<TenantId>(),
        descriptors: [
          {
            ...getMockDescriptorPublished(),
            interface: getMockDocument(),
            docs: [getMockDocument()],
          },
        ],
      };
      const testProducer = getMockTenant(testEservice.producerId);
      await addOneEService(testEservice);
      await addOneTenant(testProducer);

      const consumerId = generateId<TenantId>();
      const consumerTenant = getMockTenant(consumerId);
      await addOneTenant(consumerTenant);

      const agreement = getMockAgreement(testEservice.id, consumerId, state);
      await addOneAgreement(agreement);

      const users = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(shouldNotify ? users : []);

      const notifications = await handleEserviceStateChangedToConsumer(
        testEservice.id,
        logger,
        readModelService
      );

      const expectedNotifications = shouldNotify ? users.length : 0;
      expect(notifications).toHaveLength(expectedNotifications);

      if (shouldNotify) {
        const body = inAppTemplates.producerKeychainEServiceAddedToConsumer(
          testProducer.name,
          testEservice.name
        );
        const expectedNotifications = users.map((user) => ({
          userId: user.userId,
          tenantId: consumerId,
          body,
          notificationType: "eserviceStateChangedToConsumer",
          entityId: testEservice.id,
        }));
        expect(notifications).toEqual(
          expect.arrayContaining(expectedNotifications)
        );
      }
    }
  );

  it("should generate notifications for multiple consumers with active agreements", async () => {
    const testEservice = {
      ...getMockEService(),
      producerId: generateId<TenantId>(),
      descriptors: [
        {
          ...getMockDescriptorPublished(),
          interface: getMockDocument(),
          docs: [getMockDocument()],
        },
      ],
    };
    const testProducer = getMockTenant(testEservice.producerId);
    await addOneEService(testEservice);
    await addOneTenant(testProducer);

    // Create multiple consumers with active agreements
    const consumer1Id = generateId<TenantId>();
    const consumer2Id = generateId<TenantId>();
    const consumer1 = getMockTenant(consumer1Id);
    const consumer2 = getMockTenant(consumer2Id);

    await addOneTenant(consumer1);
    await addOneTenant(consumer2);

    const agreement1 = getMockAgreement(
      testEservice.id,
      consumer1Id,
      agreementState.active
    );
    const agreement2 = getMockAgreement(
      testEservice.id,
      consumer2Id,
      agreementState.active
    );

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);

    const users1 = [
      { userId: generateId(), tenantId: consumer1Id },
      { userId: generateId(), tenantId: consumer1Id },
    ];
    const users2 = [{ userId: generateId(), tenantId: consumer2Id }];
    const allUsers = [...users1, ...users2];

    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(allUsers);

    const notifications = await handleEserviceStateChangedToConsumer(
      testEservice.id,
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(allUsers.length);

    const body = inAppTemplates.producerKeychainEServiceAddedToConsumer(
      testProducer.name,
      testEservice.name
    );

    const expectedNotifications = allUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body,
      notificationType: "eserviceStateChangedToConsumer",
      entityId: testEservice.id,
    }));

    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });

  it("should return empty array when no user notification configs exist", async () => {
    const testEservice = {
      ...getMockEService(),
      producerId: generateId<TenantId>(),
      descriptors: [
        {
          ...getMockDescriptorPublished(),
          interface: getMockDocument(),
          docs: [getMockDocument()],
        },
      ],
    };
    const testProducer = getMockTenant(testEservice.producerId);
    await addOneEService(testEservice);
    await addOneTenant(testProducer);

    const consumerId = generateId<TenantId>();
    const consumerTenant = getMockTenant(consumerId);
    await addOneTenant(consumerTenant);

    const agreement = getMockAgreement(
      testEservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const notifications = await handleEserviceStateChangedToConsumer(
      testEservice.id,
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it("should handle mixed agreement states correctly", async () => {
    const testEservice = {
      ...getMockEService(),
      producerId: generateId<TenantId>(),
      descriptors: [
        {
          ...getMockDescriptorPublished(),
          interface: getMockDocument(),
          docs: [getMockDocument()],
        },
      ],
    };
    const testProducer = getMockTenant(testEservice.producerId);
    await addOneEService(testEservice);
    await addOneTenant(testProducer);

    // Create consumers with different agreement states
    const activeConsumerId = generateId<TenantId>();
    const archivedConsumerId = generateId<TenantId>();
    const pendingConsumerId = generateId<TenantId>();

    const activeConsumer = getMockTenant(activeConsumerId);
    const archivedConsumer = getMockTenant(archivedConsumerId);
    const pendingConsumer = getMockTenant(pendingConsumerId);

    await addOneTenant(activeConsumer);
    await addOneTenant(archivedConsumer);
    await addOneTenant(pendingConsumer);

    const activeAgreement = getMockAgreement(
      testEservice.id,
      activeConsumerId,
      agreementState.active
    );
    const archivedAgreement = getMockAgreement(
      testEservice.id,
      archivedConsumerId,
      agreementState.archived
    );
    const pendingAgreement = getMockAgreement(
      testEservice.id,
      pendingConsumerId,
      agreementState.pending
    );

    await addOneAgreement(activeAgreement);
    await addOneAgreement(archivedAgreement);
    await addOneAgreement(pendingAgreement);

    // Only active and pending consumers should get notifications
    const activeUsers = [{ userId: generateId(), tenantId: activeConsumerId }];
    const pendingUsers = [
      { userId: generateId(), tenantId: pendingConsumerId },
    ];
    const notifiableUsers = [...activeUsers, ...pendingUsers];

    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(notifiableUsers);

    const notifications = await handleEserviceStateChangedToConsumer(
      testEservice.id,
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(notifiableUsers.length);

    const body = inAppTemplates.producerKeychainEServiceAddedToConsumer(
      testProducer.name,
      testEservice.name
    );

    // eslint-disable-next-line sonarjs/no-identical-functions
    const expectedNotifications = notifiableUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body,
      notificationType: "eserviceStateChangedToConsumer",
      entityId: testEservice.id,
    }));

    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );

    // Verify that archived consumer is not included
    const archivedUserNotifications = notifications.filter(
      (notification) => notification.tenantId === archivedConsumerId
    );
    expect(archivedUserNotifications).toHaveLength(0);
  });

  it("should use correct notification template", async () => {
    const testEservice = {
      ...getMockEService(),
      name: "Test E-Service",
      producerId: generateId<TenantId>(),
      descriptors: [
        {
          ...getMockDescriptorPublished(),
          interface: getMockDocument(),
          docs: [getMockDocument()],
        },
      ],
    };
    const testProducer = {
      ...getMockTenant(testEservice.producerId),
      name: "Test Producer",
    };
    await addOneEService(testEservice);
    await addOneTenant(testProducer);

    const consumerId = generateId<TenantId>();
    const consumerTenant = getMockTenant(consumerId);
    await addOneTenant(consumerTenant);

    const agreement = getMockAgreement(
      testEservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    const users = [{ userId: generateId(), tenantId: consumerId }];
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(users);

    const notifications = await handleEserviceStateChangedToConsumer(
      testEservice.id,
      logger,
      readModelService
    );

    const expectedBody = inAppTemplates.producerKeychainEServiceAddedToConsumer(
      "Test Producer",
      "Test E-Service"
    );

    expect(notifications[0].body).toBe(expectedBody);
    expect(notifications[0].notificationType).toBe(
      "eserviceStateChangedToConsumer"
    );
    expect(notifications[0].entityId).toBe(testEservice.id);
  });
});
