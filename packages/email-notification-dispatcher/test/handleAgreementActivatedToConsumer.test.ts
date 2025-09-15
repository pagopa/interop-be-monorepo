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
  CorrelationId,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  TenantId,
  TenantNotificationConfigId,
  toAgreementV2,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eServiceNotFound, tenantNotFound } from "../src/models/errors.js";
import { handleAgreementActivatedToConsumer } from "../src/handlers/agreements/handleAgreementActivatedToConsumer.js";
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

describe("handleAgreementActivated", async () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();

  const descriptor = getMockDescriptorPublished();
  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [descriptor],
  };
  const producerTenant = {
    ...getMockTenant(producerId),
    mails: [getMockTenantMail()],
  };
  const consumerTenant = {
    ...getMockTenant(consumerId),
    mails: [getMockTenantMail()],
  };
  const users = [
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
    getMockUser(consumerTenant.id),
    getMockUser(consumerTenant.id),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
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

  it("should throw missingKafkaMessageDataError when agreement is undefined", async () => {
    await expect(() =>
      handleAgreementActivatedToConsumer({
        agreementV2Msg: undefined,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "AgreementActivated")
    );
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const unknownProducerId = generateId<TenantId>();

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: unknownProducerId,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementActivatedToConsumer({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerId));
  });

  it("should throw eServiceNotFound when eservice is not found", async () => {
    const unknownEServiceId = generateId<EServiceId>();
    const agreement = {
      ...getMockAgreement(),
      stamps: {},
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: unknownEServiceId,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementActivatedToConsumer({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(unknownEServiceId));
  });

  it("should generate one message per user of the tenant that consumed the eservice", async () => {
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivatedToConsumer({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(3);
    expect(messages.some((message) => message.address === users[2].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[3].email)).toBe(
      true
    );
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        { userId: users[2].id, tenantId: users[2].tenantId },
      ]);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivatedToConsumer({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(messages.some((message) => message.address === users[2].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[3].email)).toBe(
      false
    );
  });

  it("should generate one message to the consumer of the agreement that was activated", async () => {
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivatedToConsumer({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(3);
    expect(
      messages.some(
        (message) => message.address === consumerTenant.mails[0].address
      )
    ).toBe(true);
  });

  it("should generate a message using the latest consumer mail that was registered", async () => {
    const oldMail = { ...getMockTenantMail(), createdAt: new Date(1999) };
    const newMail = getMockTenantMail();
    const consumerTenantWithMultipleMails = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(consumerTenantWithMultipleMails);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenantWithMultipleMails.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivatedToConsumer({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(
      messages.some((message) => message.address === newMail.address)
    ).toBe(true);
  });

  it("should not generate a message to the consumer if they disabled email notification", async () => {
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: consumerTenant.id,
        enabled: false,
        createAt: new Date(),
      });

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivatedToConsumer({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(
      messages.some(
        (message) => message.address === consumerTenant.mails[0].address
      )
    ).toBe(false);
  });

  it("should generate a complete and correct message", async () => {
    const activationDate = new Date();
    const agreement = {
      ...getMockAgreement(),
      stamps: {
        activation: { when: activationDate, who: generateId<UserId>() },
      },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivatedToConsumer({
      agreementV2Msg: toAgreementV2(agreement),
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
        `La tua richiesta per &quot;${eservice.name}&quot; è stata accettata`
      );
      expect(message.email.body).toContain(producerTenant.name);
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(`Visualizza richiesta`);
    });
  });
});
