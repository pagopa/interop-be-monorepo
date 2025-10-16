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
import {
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  NotificationType,
  Purpose,
  PurposeId,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "ts-pattern";
import {
  eServiceNotFound,
  purposeNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import { handleClientPurposeRemoved } from "../src/handlers/authorization/handleClientPurposeRemovedEvent.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleClientPurposeRemoved", async () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();

  const descriptor = getMockDescriptorPublished();
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [descriptor],
  };
  const producerTenant: Tenant = {
    ...getMockTenant(producerId),
    mails: [getMockTenantMail()],
  };
  const consumerTenant: Tenant = {
    ...getMockTenant(consumerId),
    mails: [getMockTenantMail()],
  };
  const users = [
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
    getMockUser(consumerTenant.id),
    getMockUser(consumerTenant.id),
  ];

  const purpose: Purpose = {
    ...getMockPurpose(),
    id: purposeId,
    eserviceId,
    consumerId,
  };

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
    await addOnePurpose(purpose);
    for (const user of users) {
      await addOneUser(user);
    }
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: consumerTenant.id,
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
          .map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw purposeNotFound when purpose is not found", async () => {
    const unknownPurposeId = generateId<PurposeId>();

    await expect(() =>
      handleClientPurposeRemoved({
        purposeId: unknownPurposeId,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(purposeNotFound(unknownPurposeId));
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const unknownProducerId = generateId<TenantId>();

    const eserviceWithUnknownProducer: EService = {
      ...getMockEService(),
      producerId: unknownProducerId,
    };
    await addOneEService(eserviceWithUnknownProducer);

    const purposeWithUnknownProducer: Purpose = {
      ...getMockPurpose(),
      eserviceId: eserviceWithUnknownProducer.id,
      consumerId,
    };
    await addOnePurpose(purposeWithUnknownProducer);

    await expect(() =>
      handleClientPurposeRemoved({
        purposeId: purposeWithUnknownProducer.id,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerId));
  });

  it("should throw tenantNotFound when consumer is not found", async () => {
    const unknownConsumerId = generateId<TenantId>();

    const purposeWithUnknownConsumer: Purpose = {
      ...getMockPurpose(),
      eserviceId,
      consumerId: unknownConsumerId,
    };
    await addOnePurpose(purposeWithUnknownConsumer);

    await expect(() =>
      handleClientPurposeRemoved({
        purposeId: purposeWithUnknownConsumer.id,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownConsumerId));
  });

  it("should throw eServiceNotFound when eservice is not found", async () => {
    const unknownEServiceId = generateId<EServiceId>();
    const purposeWithUnknownEservice: Purpose = {
      ...getMockPurpose(),
      eserviceId: unknownEServiceId,
      consumerId,
    };
    await addOnePurpose(purposeWithUnknownEservice);

    await expect(() =>
      handleClientPurposeRemoved({
        purposeId: purposeWithUnknownEservice.id,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(unknownEServiceId));
  });

  it("should generate one message per user of the tenant", async () => {
    const messages = await handleClientPurposeRemoved({
      purposeId,
      logger,
      templateService,
      userService,
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
        { userId: users[0].id, tenantId: users[0].tenantId },
      ]);

    const messages = await handleClientPurposeRemoved({
      purposeId,
      logger,
      templateService,
      userService,
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

  it("should generate a complete and correct message", async () => {
    const messages = await handleClientPurposeRemoved({
      purposeId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(
        `Client disassociato da una finalità`
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
