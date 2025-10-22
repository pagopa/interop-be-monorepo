/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  agreementState,
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  Tenant,
  TenantId,
  TenantMail,
  TenantNotificationConfigId,
  toEServiceV2,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  descriptorPublishedNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import { handleEserviceDescriptorPublished } from "../src/handlers/eservices/handleEserviceDescriptorPublished.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleEserviceDescriptorPublished", async () => {
  const producerId = generateId<TenantId>();
  const consumerIds = [generateId<TenantId>(), generateId<TenantId>()];
  const eserviceId = generateId<EServiceId>();

  const descriptor = getMockDescriptorPublished();
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [descriptor],
  };
  const producerTenant = getMockTenant(producerId);
  const consumerTenants: Tenant[] = consumerIds.map((id) => ({
    ...getMockTenant(id),
    mails: [getMockTenantMail()],
  }));
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
    for (const user of users) {
      await addOneUser(user);
    }
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockImplementation((tenantId) => ({
        id: generateId<TenantNotificationConfigId>(),
        tenantId,
        enabled: true,
        createAt: new Date(),
      }));
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

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceDescriptorPublished({
        eserviceV2Msg: undefined,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorPublished")
    );
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const unknownProducerId = generateId<TenantId>();

    const eserviceWithUnknownProducer: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      producerId: unknownProducerId,
    };

    await expect(() =>
      handleEserviceDescriptorPublished({
        eserviceV2Msg: toEServiceV2(eserviceWithUnknownProducer),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerId));
  });

  it("should throw descriptorPublishedNotFound when descriptor is not found", async () => {
    const eserviceNoDescriptor: EService = {
      ...getMockEService(),
      descriptors: [],
    };
    await addOneEService(eserviceNoDescriptor);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: {},
      producerId: producerTenant.id,
      eserviceId: eserviceNoDescriptor.id,
      consumerId: consumerTenants[0].id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleEserviceDescriptorPublished({
        eserviceV2Msg: toEServiceV2(eserviceNoDescriptor),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(descriptorPublishedNotFound(agreement.eserviceId));
  });

  it("should return empty array if no consumer is present for the eservice", async () => {
    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the tenants that consumed the eservice", async () => {
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

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(6);
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
        { userId: users[0].id, tenantId: users[0].tenantId },
        { userId: users[2].id, tenantId: users[2].tenantId },
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

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
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

  it("should generate one message to the consumers of the eservice", async () => {
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

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(6);
    expect(
      messages.some(
        (message) =>
          message.type === "Tenant" &&
          message.address === consumerTenants[0].mails[0].address
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) =>
          message.type === "Tenant" &&
          message.address === consumerTenants[1].mails[0].address
      )
    ).toBe(true);
  });

  it("should generate a message using the latest consumer mail that was registered", async () => {
    const oldMail: TenantMail = {
      ...getMockTenantMail(),
      createdAt: new Date(1999),
    };
    const newMail = getMockTenantMail();
    const consumerTenantWithMultipleMails: Tenant = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(consumerTenantWithMultipleMails);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenantWithMultipleMails.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(
      messages.some(
        (message) =>
          message.type === "Tenant" && message.address === newMail.address
      )
    ).toBe(true);
  });

  it("should not generate a message to the consumer if they disabled email notification", async () => {
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: consumerTenants[0].id,
        enabled: false,
        createAt: new Date(),
      });

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenants[0].id,
    };
    await addOneAgreement(agreement);

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(2);
    expect(
      messages.some(
        (message) =>
          message.type === "Tenant" &&
          message.address === consumerTenants[0].mails[0].address
      )
    ).toBe(false);
  });

  it("should generate a complete and correct message", async () => {
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

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(3);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(
        `Nuova versione disponibile per &quot;${eservice.name}&quot;`
      );
      expect(message.email.body).toContain(producerTenant.name);
      expect(message.email.body).toContain(consumerTenants[0].name);
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(descriptor.version);
      expect(message.email.body).toContain(`Visualizza e-service`);
    });
  });
});
