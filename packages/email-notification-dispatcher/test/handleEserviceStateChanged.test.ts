/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptorPublished,
  getMockDocument,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  CorrelationId,
  Descriptor,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleEserviceStateChanged } from "../src/handlers/eservices/handleEserviceStateChanged.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceStateChanged", async () => {
  const producerId = generateId<TenantId>();
  const consumerIds = [generateId<TenantId>(), generateId<TenantId>()];
  const eserviceId = generateId<EServiceId>();

  const descriptor: Descriptor = {
    ...getMockDescriptorPublished(),
    interface: getMockDocument(),
    docs: [getMockDocument()],
  };
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [descriptor],
  };
  const producerTenant = getMockTenant(producerId);
  const consumerTenants = consumerIds.map((id) => getMockTenant(id));
  const users = [
    getMockUser(consumerTenants[0].id),
    getMockUser(consumerTenants[0].id),
    getMockUser(consumerTenants[1].id),
    getMockUser(consumerTenants[1].id),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenants[0]);
    await addOneTenant(consumerTenants[1]);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockImplementation((tenantIds, _notificationType) =>
        users
          .filter((user) => tenantIds.includes(user.tenantId))
          .map((user) => ({
            userId: user.id,
            tenantId: user.tenantId,
            // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
            userRoles: [authRole.ADMIN_ROLE],
          }))
      );
  });

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceStateChanged({
        payload: {
          data: {
            eservice: undefined,
          },
          event_version: 2,
          type: "EServiceNameUpdated",
        },
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceNameUpdated")
    );
  });

  it("should skip event if no consumer is present for the eservice", async () => {
    const messages = await handleEserviceStateChanged({
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
        },
        event_version: 2,
        type: "EServiceNameUpdated",
      },
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the consumers of the eservice", async () => {
    const agreements: Agreement[] = consumerTenants.map((consumerTenant) => ({
      ...getMockAgreement(),
      stamps: {},
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
      state: agreementState.active,
    }));
    await addOneAgreement(agreements[0]);
    await addOneAgreement(agreements[1]);

    const messages = await handleEserviceStateChanged({
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
        },
        event_version: 2,
        type: "EServiceNameUpdated",
      },
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(4);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[2].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[3].id
      )
    ).toBe(true);
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        {
          userId: users[0].id,
          tenantId: users[0].tenantId,
          // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
          userRoles: [authRole.ADMIN_ROLE],
        },
        {
          userId: users[2].id,
          tenantId: users[2].tenantId,
          userRoles: [authRole.ADMIN_ROLE],
        },
      ]);

    const agreements: Agreement[] = consumerTenants.map((consumerTenant) => ({
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: {},
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    }));
    await addOneAgreement(agreements[0]);
    await addOneAgreement(agreements[1]);

    const messages = await handleEserviceStateChanged({
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
        },
        event_version: 2,
        type: "EServiceNameUpdated",
      },
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(false);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[2].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[3].id
      )
    ).toBe(false);
  });

  it.each([
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
          oldName: "Old Name",
        },
        event_version: 2,
        type: "EServiceNameUpdated",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].id}`,
        title: `L'e-service "Old Name" è stato rinominato`,
        tokens: ["Old Name"],
      },
    },
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
          oldName: "Old Name",
        },
        event_version: 2,
        type: "EServiceNameUpdatedByTemplateUpdate",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].id}`,
        title: `L'e-service "Old Name" è stato rinominato`,
        tokens: ["Old Name"],
      },
    },
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
        },
        event_version: 2,
        type: "EServiceDescriptionUpdated",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].id}`,
        title: `Modifiche alla versione di "${eservice.name}"`,
        tokens: [producerTenant.name, descriptor.version, eservice.name],
      },
    },
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        },
        event_version: 2,
        type: "EServiceDescriptorQuotasUpdated",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].id}`,
        title: `Modifiche alla versione di "${eservice.name}"`,
        tokens: [producerTenant.name, descriptor.version, eservice.name],
      },
    },
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        },
        event_version: 2,
        type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].id}`,
        title: `Modifiche alla versione di "${eservice.name}"`,
        tokens: [producerTenant.name, descriptor.version, eservice.name],
      },
    },
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
        event_version: 2,
        type: "EServiceDescriptorDocumentAdded",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].id}`,
        title: `Modifiche alla versione di "${eservice.name}"`,
        tokens: [producerTenant.name, descriptor.version, eservice.name],
      },
    },
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
        event_version: 2,
        type: "EServiceDescriptorDocumentAddedByTemplateUpdate",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].id}`,
        title: `Modifiche alla versione di "${eservice.name}"`,
        tokens: [producerTenant.name, descriptor.version, eservice.name],
      },
    },
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
        event_version: 2,
        type: "EServiceDescriptorDocumentUpdated",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].docs[0].id}`,
        title: `Modifiche alla versione di "${eservice.name}"`,
        tokens: [producerTenant.name, descriptor.version, eservice.name],
      },
    },
    {
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
          documentId: eservice.descriptors[0].docs[0].id,
        },
        event_version: 2,
        type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
      },
      expected: {
        entityId: `${eservice.id}/${eservice.descriptors[0].docs[0].id}`,
        title: `Modifiche alla versione di "${eservice.name}"`,
        tokens: [producerTenant.name, descriptor.version, eservice.name],
      },
    },
  ] as const)(
    "should generate a complete and correct message for event $payload.type",
    async ({ payload, expected }) => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {},
        producerId: producerTenant.id,
        descriptorId: descriptor.id,
        eserviceId: eservice.id,
        consumerId: consumerTenants[0].id,
      };
      await addOneAgreement(agreement);

      const messages = await handleEserviceStateChanged({
        payload,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

      expect(messages.length).toBe(2);
      messages.forEach((message) => {
        expect(message.email.body).toContain("<!-- Footer -->");
        expect(message.email.body).toContain("<!-- Title & Main Message -->");
        expect(message.email.subject).toBe(expected.title);
        expect(message.email.body).toContain(
          expected.title.replaceAll(`"`, `&quot;`).replaceAll(`'`, `&#x27;`)
        );
        expected.tokens.forEach((token) =>
          expect(message.email.body).toContain(token)
        );
        expect(message.email.body).toContain(consumerTenants[0].name);
      });
    }
  );

  it("should set tenantId to consumer's tenant ID, not producer's ID", async () => {
    const agreements: Agreement[] = consumerTenants.map((consumerTenant) => ({
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: {},
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    }));
    await addOneAgreement(agreements[0]);
    await addOneAgreement(agreements[1]);

    const messages = await handleEserviceStateChanged({
      payload: {
        data: {
          eservice: toEServiceV2(eservice),
        },
        event_version: 2,
        type: "EServiceNameUpdated",
      },
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(4);
    // Verify that all messages have tenantId set to consumer's tenant ID, not producer's ID
    messages.forEach((message) => {
      expect(message.tenantId).not.toBe(producerTenant.id);
      expect(
        consumerTenants.some((consumer) => consumer.id === message.tenantId)
      ).toBe(true);
    });

    // Verify specific consumer tenant IDs are present
    expect(
      messages.some((message) => message.tenantId === consumerTenants[0].id)
    ).toBe(true);
    expect(
      messages.some((message) => message.tenantId === consumerTenants[1].id)
    ).toBe(true);
  });
});
