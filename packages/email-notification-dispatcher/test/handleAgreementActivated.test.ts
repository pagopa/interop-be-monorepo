/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptor,
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
  TenantId,
  toAgreementV2,
  UserId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import { handleAgreementActivated } from "../src/handlers/agreements/handleAgreementActivated.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockUser,
  interopFeBaseUrl,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleAgreementActivated", async () => {
  const agreement = {
    ...getMockAgreement(),
    producerId: generateId<TenantId>(),
    descriptors: [getMockDescriptorPublished()],
  };

  const { logger } = getMockContext({});

  await addOneAgreement(agreement);

  const userService = {
    readUser: vi.fn(),
  };

  it("should throw missingKafkaMessageDataError when agreement is undefined", async () => {
    await expect(() =>
      handleAgreementActivated({
        agreementV2Msg: undefined,
        logger,
        interopFeBaseUrl,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "AgreementActivated")
    );
  });

  it("should throw tenantNotFound when consumer is not found", async () => {
    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const consumerId = generateId<TenantId>();

    const producerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(producerTenant);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementActivated({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(consumerId));
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const consumerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const producerId = generateId<TenantId>();

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementActivated({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(producerId));
  });

  it("should throw agreementStampDateNotFound when activation date is not found", async () => {
    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const consumerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const producerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(producerTenant);

    const agreement = {
      ...getMockAgreement(),
      stamps: {},
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementActivated({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(agreementStampDateNotFound("activation", agreement.id));
  });

  it("should throw eServiceNotFound when eservice is not found", async () => {
    const descriptor = getMockDescriptor();
    const eServiceId = generateId<EServiceId>();

    const consumerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const producerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(producerTenant);

    const agreement = {
      ...getMockAgreement(),
      stamps: {},
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eServiceId,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementActivated({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(eServiceId));
  });

  it("should throw descriptorNotFound when descriptor is not found", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);

    const consumerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const producerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(producerTenant);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementActivated({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      descriptorNotFound(agreement.eserviceId, agreement.descriptorId)
    );
  });

  it("should generate one message per user of the tenant that consumed the eservice", async () => {
    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const consumerTenant = getMockTenant();
    await addOneTenant(consumerTenant);

    const producerTenant = getMockTenant();
    await addOneTenant(producerTenant);

    const users = [
      getMockUser(consumerTenant.id),
      getMockUser(consumerTenant.id),
    ];
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockReturnValueOnce(
        users.map((user) => ({ userId: user.userId, tenantId: user.tenantId }))
      );
    userService.readUser.mockImplementation((userId) =>
      users.find((user) => user.userId === userId)
    );

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivated({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(2);
  });

  it("should generate one message to the consumer whose agreement was activated", async () => {
    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const consumerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const producerTenant = getMockTenant();
    await addOneTenant(producerTenant);

    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockReturnValueOnce([]);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivated({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(1);
    expect(messages[0].address).toEqual(consumerTenant.mails[0].address);
  });

  it("should generate a message using the latest consumer mail that was registered", async () => {
    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const oldMail = { ...getMockTenantMail(), createdAt: new Date(1999) };
    const newMail = getMockTenantMail();
    const consumerTenant = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(consumerTenant);

    const producerTenant = {
      ...getMockTenant(),
    };
    await addOneTenant(producerTenant);

    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockReturnValueOnce([]);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementActivated({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(1);
    expect(messages[0].address).toEqual(newMail.address);
  });

  it("should generate a complete and correct message", async () => {
    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const consumerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const producerTenant = getMockTenant();
    await addOneTenant(producerTenant);

    const user = getMockUser(consumerTenant.id);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockReturnValueOnce([{ userId: user.userId, tenantId: user.tenantId }]);
    userService.readUser.mockImplementation((_) => user);

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

    const messages = await handleAgreementActivated({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(2);
    expect(messages[0].address).toBe(user.email);
    expect(messages[1].address).toBe(consumerTenant.mails[0].address);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(`Nuova richiesta di fruizione`);
      expect(message.email.body).toContain(
        `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`
      );
      expect(message.email.body).toContain(producerTenant.name);
      expect(message.email.body).toContain(consumerTenant.name);
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(descriptor.version);
      // expect(message.email.body).toContain(dateAtRomeZone(activationDate));
    });
  });
});
