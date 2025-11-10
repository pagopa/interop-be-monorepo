/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  Purpose,
  Tenant,
  TenantId,
  TenantMail,
  TenantNotificationConfigId,
  toPurposeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "ts-pattern";
import { eServiceNotFound, tenantNotFound } from "../src/models/errors.js";
import { handleNewPurposeVersionWaitingForApproval } from "../src/handlers/purposes/handleNewPurposeVersionWaitingForApproval.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleNewPurposeVersionWaitingForApproval", async () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();

  const descriptor = getMockDescriptorPublished();
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [descriptor],
  };
  const producerTenant: Tenant = {
    ...getMockTenant(producerId),
    name: "Producer Tenant",
    mails: [getMockTenantMail()],
  };
  const consumerTenant = {
    ...getMockTenant(consumerId),
    name: "Consumer Tenant",
  };
  const users = [
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
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
            // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
            userRoles: [authRole.ADMIN_ROLE],
          }))
      );
  });

  it("should throw missingKafkaMessageDataError when purpose is undefined", async () => {
    await expect(() =>
      handleNewPurposeVersionWaitingForApproval({
        purposeV2Msg: undefined,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "purpose",
        "NewPurposeVersionWaitingForApproval"
      )
    );
  });

  it("should throw tenantNotFound when consumer is not found", async () => {
    const unknownConsumerId = generateId<TenantId>();

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: unknownConsumerId,
    };
    await addOnePurpose(purpose);

    await expect(() =>
      handleNewPurposeVersionWaitingForApproval({
        purposeV2Msg: toPurposeV2(purpose),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownConsumerId));
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const unknownProducerId = generateId<TenantId>();

    const eserviceWithUnknownProducer: EService = {
      ...getMockEService(),
      producerId: unknownProducerId,
    };
    await addOneEService(eserviceWithUnknownProducer);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eserviceWithUnknownProducer.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    await expect(() =>
      handleNewPurposeVersionWaitingForApproval({
        purposeV2Msg: toPurposeV2(purpose),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerId));
  });

  it("should throw eServiceNotFound when eservice is not found", async () => {
    const unknownEServiceId = generateId<EServiceId>();

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: unknownEServiceId,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    await expect(() =>
      handleNewPurposeVersionWaitingForApproval({
        purposeV2Msg: toPurposeV2(purpose),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(unknownEServiceId));
  });

  it("should generate one message per user of the producer", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApproval({
      purposeV2Msg: toPurposeV2(purpose),
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
      ]);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApproval({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
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
  });

  it("should generate one message to the producer", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApproval({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    // Tenant contact emails are not included since includeTenantContactEmails is false
    expect(
      messages.every((message) => message.type === "User")
    ).toBe(true);
  });

  it("should generate a message using the latest producer mail that was registered", async () => {
    const oldMail: TenantMail = {
      ...getMockTenantMail(),
      createdAt: new Date(1999),
    };
    const newMail = getMockTenantMail();
    const producerTenantWithMultipleMails: Tenant = {
      ...getMockTenant(producerId),
      mails: [oldMail, newMail],
    };
    await addOneTenant(producerTenantWithMultipleMails);

    // Mock to return no users for this specific producer
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const eserviceWithMultipleMailProducer: EService = {
      ...getMockEService(),
      producerId: producerTenantWithMultipleMails.id,
    };
    await addOneEService(eserviceWithMultipleMailProducer);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eserviceWithMultipleMailProducer.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApproval({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(0);
  });

  it("should not generate a message to the producer if they disabled email notification", async () => {
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: producerTenant.id,
        enabled: false,
        createAt: new Date(),
      });

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApproval({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(
      messages.some(
        (message) =>
          message.type === "Tenant" &&
          message.address === producerTenant.mails[0].address
      )
    ).toBe(false);
  });

  it("should generate a complete and correct message", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId,
      consumerId,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApproval({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain(
        `Richiesta adeguamento piano di carico per la finalità &quot;${purpose.title}&quot;`
      );
      match(message.type)
        .with("User", () => {
          expect(message.email.body).toContain("{{ recipientName }}");
          expect(message.email.body).toContain(consumerTenant.name);
        })
        .with("Tenant", () => {
          expect(message.email.body).toContain(producerTenant.name);
          expect(message.email.body).toContain(consumerTenant.name);
        })
        .exhaustive();
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(purpose.title);
    });
  });
});
