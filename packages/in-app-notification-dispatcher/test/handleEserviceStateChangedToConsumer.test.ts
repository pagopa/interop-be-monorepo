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
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
  type EServiceEventV2,
  type EServiceDescriptorPublishedV2,
  unsafeBrandId,
  EServiceId,
  AttributeId,
  archivingScope,
  GracePeriodDays,
  gracePeriodDays,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  tenantNotFound,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

import { handleEserviceStateChangedToConsumer } from "../src/handlers/eservices/handleEserviceStateChangedToConsumer.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceStateChangedToConsumer", async () => {
  const producerTenant = getMockTenant();
  const consumerTenant = getMockTenant();

  const eservice = {
    ...getMockEService(),
    producerId: producerTenant.id,
    descriptors: [
      {
        ...getMockDescriptorPublished(),
        interface: getMockDocument(),
        docs: [getMockDocument()],
      },
    ],
  };
  const getEserviceWithArchivingSchedule = (
    gracePeriodDaysValue: GracePeriodDays
  ) => ({
    ...getMockEService(),
    producerId: producerTenant.id,
    descriptors: [
      {
        ...getMockDescriptorPublished(),
        interface: getMockDocument(),
        docs: [getMockDocument()],
        archivingSchedule: {
          archivableOn: new Date("2026-12-31T00:00:00.000Z"),
          startedAt: new Date("2026-05-14T00:00:00.000Z"),
          scope: archivingScope.descriptor,
          gracePeriodDays: gracePeriodDaysValue,
        },
      },
      {
        ...getMockDescriptorPublished(),
        version: "2",
        interface: getMockDocument(),
        docs: [getMockDocument()],
      },
    ],
  });
  const getArchivingEservice = (gracePeriodDaysValue: GracePeriodDays) => ({
    ...getMockEService(),
    producerId: producerTenant.id,
    descriptors: [
      {
        ...getMockDescriptorPublished(),
        interface: getMockDocument(),
        docs: [getMockDocument()],
        archivingSchedule: {
          archivableOn: new Date("2026-12-31T00:00:00.000Z"),
          startedAt: new Date("2026-05-14T00:00:00.000Z"),
          scope: archivingScope.eservice,
          gracePeriodDays: gracePeriodDaysValue,
        },
      },
    ],
  });
  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;
  await addOneEService(eservice);

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
  });

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorPublished",
      data: {
        eservice: undefined,
        descriptorId: eservice.descriptors[0].id,
      } satisfies EServiceDescriptorPublishedV2,
    };

    await expect(() =>
      handleEserviceStateChangedToConsumer(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorPublished")
    );
  });

  it("should return empty array when no agreements exist for the eservice", async () => {
    await addOneTenant(producerTenant);
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorPublished",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
      } satisfies EServiceDescriptorPublishedV2,
    };

    const notifications = await handleEserviceStateChangedToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
  });

  it("should throw tenantNotFound when tenant is not found", async () => {
    await addOneTenant(producerTenant);
    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorPublished",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
      } satisfies EServiceDescriptorPublishedV2,
    };

    // eslint-disable-next-line sonarjs/no-identical-functions
    await expect(() =>
      handleEserviceStateChangedToConsumer(msg, logger, readModelService)
    ).rejects.toThrow(tenantNotFound(consumerId));
  });

  it.each([
    { state: agreementState.pending, isNotified: true },
    { state: agreementState.active, isNotified: true },
    { state: agreementState.suspended, isNotified: true },
    { state: agreementState.archived, isNotified: false },
    {
      state: agreementState.missingCertifiedAttributes,
      isNotified: false,
    },
    { state: agreementState.rejected, isNotified: false },
  ])(
    "should generate notifications for EServiceDescriptorPublished for agreement in $state state (isNotified: $isNotified)",
    async ({ state, isNotified }) => {
      const eservice = {
        ...getMockEService(),
        producerId: producerTenant.id,
        descriptors: [
          {
            ...getMockDescriptorPublished(),
            interface: getMockDocument(),
            docs: [getMockDocument()],
          },
        ],
      };
      await addOneTenant(producerTenant);
      await addOneTenant(consumerTenant);
      await addOneEService(eservice);

      const agreement = getMockAgreement(eservice.id, consumerTenant.id, state);
      await addOneAgreement(agreement);

      const users = [
        { userId: generateId(), tenantId: consumerTenant.id },
        { userId: generateId(), tenantId: consumerTenant.id },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorPublished",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        } satisfies EServiceDescriptorPublishedV2,
      };

      const notifications = await handleEserviceStateChangedToConsumer(
        msg,
        logger,
        readModelService
      );

      const expectedNotifications = isNotified ? users.length : 0;
      expect(notifications).toHaveLength(expectedNotifications);
      if (isNotified) {
        const body = inAppTemplates.eserviceDescriptorPublishedToConsumer(
          eservice.name,
          eservice.descriptors[0].version,
          producerTenant.name
        );
        const expectedNotifications = users.map((user) => ({
          userId: user.userId,
          tenantId: consumerTenant.id,
          body,
          notificationType: "eserviceStateChangedToConsumer",
          entityId: `${eservice.id}/${eservice.descriptors[0].id}`,
        }));
        expect(notifications).toEqual(
          expect.arrayContaining(expectedNotifications)
        );
      }
    }
  );

  it.each([
    {
      msg: {
        event_version: 2,
        type: "EServiceNameUpdated",
        data: {
          eservice: toEServiceV2(eservice),
          oldName: "oldName",
        },
      },
      expectedBody: inAppTemplates.eserviceNameUpdatedToConsumer(
        eservice,
        "oldName"
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceNameUpdatedByTemplateUpdate",
        data: {
          eservice: toEServiceV2(eservice),
          oldName: "oldName",
        },
      },
      expectedBody: inAppTemplates.eserviceNameUpdatedToConsumer(
        eservice,
        "oldName"
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptionUpdated",
        data: {
          eservice: toEServiceV2(eservice),
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptionUpdatedToConsumer(
        eservice.name,
        eservice.descriptors[0].version,
        producerTenant.name
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptionUpdatedByTemplateUpdate",
        data: {
          eservice: toEServiceV2(eservice),
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptionUpdatedToConsumer(
        eservice.name,
        eservice.descriptors[0].version,
        producerTenant.name
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorAttributesUpdated",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          attributeIds: [generateId<AttributeId>()] as AttributeId[],
        },
      },
      expectedBody:
        inAppTemplates.eserviceDescriptorAttributesUpdatedToConsumer(
          eservice.name,
          producerTenant.name
        ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          attributeIds: [generateId<AttributeId>()] as AttributeId[],
        },
      },
      expectedBody:
        inAppTemplates.eserviceDescriptorAttributesUpdatedToConsumer(
          eservice.name,
          producerTenant.name
        ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorAttributeDailyCallsPerConsumerUpdated",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          attributeId: generateId<AttributeId>(),
          dailyCallsPerConsumer: 10,
        },
      },
      expectedBody:
        inAppTemplates.eserviceDescriptorAttributesUpdatedToConsumer(
          eservice.name,
          producerTenant.name
        ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorSuspended",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorSuspendedToConsumer(
        eservice.name,
        producerTenant.name,
        eservice.descriptors[0].version
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorActivated",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorActivatedToConsumer(
        eservice.name,
        producerTenant.name,
        eservice.descriptors[0].version
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorQuotasUpdated",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorQuotasUpdatedToConsumer(
        eservice.name,
        eservice.descriptors[0].version,
        producerTenant.name
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorQuotasUpdatedToConsumer(
        eservice.name,
        eservice.descriptors[0].version,
        producerTenant.name
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorDocumentAdded",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorDocumentAddedToConsumer(
        eservice.name,
        "1",
        producerTenant.name
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorDocumentAddedByTemplateUpdate",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorDocumentAddedToConsumer(
        eservice.name,
        "1",
        producerTenant.name
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorDocumentUpdated",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorDocumentUpdatedToConsumer(
        eservice.name,
        eservice.descriptors[0].docs[0].prettyName,
        eservice.descriptors[0].version,
        producerTenant.name
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorDocumentUpdatedToConsumer(
        eservice.name,
        eservice.descriptors[0].docs[0].prettyName,
        eservice.descriptors[0].version,
        producerTenant.name
      ),
    },
  ] as const)(
    "should generate notifications for $msg.type",
    async ({ msg, expectedBody }) => {
      const consumerId = generateId<TenantId>();
      const consumerTenant = getMockTenant(consumerId);

      // eslint-disable-next-line functional/immutable-data
      readModelService.getAgreementsByEserviceId = vi
        .fn()
        .mockResolvedValue([
          getMockAgreement(
            unsafeBrandId<EServiceId>(msg.data.eservice.id),
            consumerId,
            agreementState.active
          ),
        ]);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantById = vi
        .fn()
        .mockResolvedValue(consumerTenant);

      const users = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications = await handleEserviceStateChangedToConsumer(
        msg,
        logger,
        readModelService
      );

      const expectedNotifications = users.map((user) => ({
        userId: user.userId,
        tenantId: consumerId,
        body: expectedBody,
        notificationType: "eserviceStateChangedToConsumer",
        entityId: `${msg.data.eservice.id}/${msg.data.eservice.descriptors[0].id}`,
      }));
      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it.each([...gracePeriodDays])(
    "should generate notifications for EServiceDescriptorSuspended with archivingSchedule (descriptor scope, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const eserviceWithArchivingSchedule =
        getEserviceWithArchivingSchedule(gracePeriodDaysValue);
      await addOneEService(eserviceWithArchivingSchedule);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorSuspended",
        data: {
          eservice: toEServiceV2(eserviceWithArchivingSchedule),
          descriptorId: eserviceWithArchivingSchedule.descriptors[0].id,
        },
      };
      const expectedBody =
        inAppTemplates.eserviceArchivingDescriptorSuspendedToConsumer(
          eserviceWithArchivingSchedule.name,
          eserviceWithArchivingSchedule.descriptors[0].version,
          eserviceWithArchivingSchedule.descriptors[0]!.archivingSchedule!
            .archivableOn!,
          true
        );

      const consumerId = generateId<TenantId>();
      const consumerTenantForCase = getMockTenant(consumerId);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getAgreementsByEserviceId = vi
        .fn()
        .mockResolvedValue([
          getMockAgreement(
            unsafeBrandId<EServiceId>(msg.data.eservice!.id),
            consumerId,
            agreementState.active
          ),
        ]);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantById = vi
        .fn()
        .mockResolvedValue(consumerTenantForCase);

      const users = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications = await handleEserviceStateChangedToConsumer(
        msg,
        logger,
        readModelService
      );

      const expectedNotifications = users.map((user) => ({
        userId: user.userId,
        tenantId: consumerId,
        body: expectedBody,
        notificationType: "eserviceStateChangedToConsumer",
        entityId: `${msg.data.eservice!.id}/${msg.data.eservice!.descriptors[0].id}`,
      }));
      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it.each([...gracePeriodDays])(
    "should generate notifications for EServiceDescriptorSuspended with archivingSchedule (eservice scope, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingEservice = getArchivingEservice(gracePeriodDaysValue);
      await addOneEService(archivingEservice);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorSuspended",
        data: {
          eservice: toEServiceV2(archivingEservice),
          descriptorId: archivingEservice.descriptors[0].id,
        },
      };
      const expectedBody =
        inAppTemplates.eserviceArchivingDescriptorSuspendedToConsumer(
          archivingEservice.name,
          archivingEservice.descriptors[0].version,
          archivingEservice.descriptors[0]!.archivingSchedule!.archivableOn!,
          false
        );

      const consumerId = generateId<TenantId>();
      const consumerTenantForCase = getMockTenant(consumerId);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getAgreementsByEserviceId = vi
        .fn()
        .mockResolvedValue([
          getMockAgreement(
            unsafeBrandId<EServiceId>(msg.data.eservice!.id),
            consumerId,
            agreementState.active
          ),
        ]);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantById = vi
        .fn()
        .mockResolvedValue(consumerTenantForCase);

      const users = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications = await handleEserviceStateChangedToConsumer(
        msg,
        logger,
        readModelService
      );

      const expectedNotifications = users.map((user) => ({
        userId: user.userId,
        tenantId: consumerId,
        body: expectedBody,
        notificationType: "eserviceStateChangedToConsumer",
        entityId: `${msg.data.eservice!.id}/${msg.data.eservice!.descriptors[0].id}`,
      }));
      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it.each([...gracePeriodDays])(
    "should generate notifications for EServiceDescriptorActivated with archivingSchedule (descriptor scope, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const eserviceWithArchivingSchedule =
        getEserviceWithArchivingSchedule(gracePeriodDaysValue);
      await addOneEService(eserviceWithArchivingSchedule);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorActivated",
        data: {
          eservice: toEServiceV2(eserviceWithArchivingSchedule),
          descriptorId: eserviceWithArchivingSchedule.descriptors[0].id,
        },
      };
      const expectedBody =
        inAppTemplates.eserviceArchivingDescriptorActivatedToConsumer(
          eserviceWithArchivingSchedule.name,
          eserviceWithArchivingSchedule.descriptors[0].version,
          eserviceWithArchivingSchedule.descriptors[0]!.archivingSchedule!
            .archivableOn!,
          false
        );

      const consumerId = generateId<TenantId>();
      const consumerTenantForCase = getMockTenant(consumerId);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getAgreementsByEserviceId = vi
        .fn()
        .mockResolvedValue([
          getMockAgreement(
            unsafeBrandId<EServiceId>(msg.data.eservice!.id),
            consumerId,
            agreementState.active
          ),
        ]);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantById = vi
        .fn()
        .mockResolvedValue(consumerTenantForCase);

      const users = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications = await handleEserviceStateChangedToConsumer(
        msg,
        logger,
        readModelService
      );

      const expectedNotifications = users.map((user) => ({
        userId: user.userId,
        tenantId: consumerId,
        body: expectedBody,
        notificationType: "eserviceStateChangedToConsumer",
        entityId: `${msg.data.eservice!.id}/${msg.data.eservice!.descriptors[0].id}`,
      }));
      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it.each([...gracePeriodDays])(
    "should generate notifications for EServiceDescriptorActivated with archivingSchedule (eservice scope, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingEservice = getArchivingEservice(gracePeriodDaysValue);
      await addOneEService(archivingEservice);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorActivated",
        data: {
          eservice: toEServiceV2(archivingEservice),
          descriptorId: archivingEservice.descriptors[0].id,
        },
      };
      const expectedBody =
        inAppTemplates.eserviceArchivingDescriptorActivatedToConsumer(
          archivingEservice.name,
          archivingEservice.descriptors[0].version,
          archivingEservice.descriptors[0]!.archivingSchedule!.archivableOn!,
          true
        );

      const consumerId = generateId<TenantId>();
      const consumerTenantForCase = getMockTenant(consumerId);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getAgreementsByEserviceId = vi
        .fn()
        .mockResolvedValue([
          getMockAgreement(
            unsafeBrandId<EServiceId>(msg.data.eservice!.id),
            consumerId,
            agreementState.active
          ),
        ]);
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantById = vi
        .fn()
        .mockResolvedValue(consumerTenantForCase);

      const users = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications = await handleEserviceStateChangedToConsumer(
        msg,
        logger,
        readModelService
      );

      const expectedNotifications = users.map((user) => ({
        userId: user.userId,
        tenantId: consumerId,
        body: expectedBody,
        notificationType: "eserviceStateChangedToConsumer",
        entityId: `${msg.data.eservice!.id}/${msg.data.eservice!.descriptors[0].id}`,
      }));
      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it("should return empty array when no user notification configs exist for the eservice", async () => {
    const consumerId = generateId<TenantId>();
    const consumerTenant = getMockTenant(consumerId);
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);
    await addOneTenant(consumerTenant);

    mockGetNotificationRecipients.mockResolvedValue([]);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorPublished",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
      },
    };

    const notifications = await handleEserviceStateChangedToConsumer(
      msg,
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });
});
