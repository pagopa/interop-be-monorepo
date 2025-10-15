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
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
  type EServiceEventV2,
  type EServiceDescriptorPublishedV2,
  unsafeBrandId,
  EServiceId,
  AttributeId,
} from "pagopa-interop-models";
import { handleEserviceStateChangedToConsumer } from "../src/handlers/eservices/handleEserviceStateChangedToConsumer.js";
import { tenantNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceStateChangedToConsumer", async () => {
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
  const { logger } = getMockContext({});
  await addOneEService(eservice);

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
        producerId: generateId<TenantId>(),
        descriptors: [
          {
            ...getMockDescriptorPublished(),
            interface: getMockDocument(),
            docs: [getMockDocument()],
          },
        ],
      };
      await addOneEService(eservice);

      const consumerId = generateId<TenantId>();
      const consumerTenant = getMockTenant(consumerId);
      await addOneTenant(consumerTenant);

      const agreement = getMockAgreement(eservice.id, consumerId, state);
      await addOneAgreement(agreement);

      const users = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(users);

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
          eservice.name
        );
        const expectedNotifications = users.map((user) => ({
          userId: user.userId,
          tenantId: consumerId,
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
        eservice.name
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
        eservice.name
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
          eservice.name
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
          eservice.name
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
        eservice.name
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
        eservice.name
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
        eservice.name
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
        eservice.name
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorAgreementApprovalPolicyUpdated",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        },
      },
      expectedBody:
        inAppTemplates.eserviceDescriptorAgreementApprovalPolicyUpdatedToConsumer(
          eservice.name
        ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorInterfaceAdded",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].interface.id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorInterfaceAddedToConsumer(
        eservice.name,
        eservice.descriptors[0].interface.prettyName
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
        eservice.descriptors[0].docs[0].prettyName
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
        eservice.descriptors[0].docs[0].prettyName
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorDocumentDeleted",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorDocumentDeletedToConsumer(
        eservice.name,
        eservice.descriptors[0].docs[0].prettyName
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorDocumentDeletedByTemplateUpdate",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorDocumentDeletedToConsumer(
        eservice.name,
        eservice.descriptors[0].docs[0].prettyName
      ),
    },
    {
      msg: {
        event_version: 2,
        type: "EServiceDescriptorInterfaceUpdated",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].interface.id,
        },
      },
      expectedBody: inAppTemplates.eserviceDescriptorInterfaceUpdatedToConsumer(
        eservice.name,
        eservice.descriptors[0].interface.prettyName
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
        eservice.descriptors[0].docs[0].prettyName
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
        eservice.descriptors[0].docs[0].prettyName
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
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(users);

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

    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

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
