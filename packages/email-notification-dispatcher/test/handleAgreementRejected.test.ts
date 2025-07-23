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
import { describe, expect, it } from "vitest";
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import { handleAgreementRejected } from "../src/handlers/handleAgreementRejected.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  interopFeBaseUrl,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleAgreementRejected", async () => {
  const agreement = {
    ...getMockAgreement(),
    producerId: generateId<TenantId>(),
    descriptors: [getMockDescriptorPublished()],
  };

  const { logger } = getMockContext({});

  await addOneAgreement(agreement);

  it("should throw missingKafkaMessageDataError when agreement is undefined", async () => {
    await expect(() =>
      handleAgreementRejected({
        agreementV2Msg: undefined,
        logger,
        interopFeBaseUrl,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "AgreementRejected")
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
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementRejected({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
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
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementRejected({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(producerId));
  });

  it("should throw agreementStampDateNotFound when rejection date is not found", async () => {
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
      handleAgreementRejected({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(agreementStampDateNotFound("rejection", agreement.id));
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
      handleAgreementRejected({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        interopFeBaseUrl,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(eServiceId));
  });

  it("should generate no messages when no emails exist for the consumer", async () => {
    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const consumerTenant = {
      ...getMockTenant(),
      mails: [],
    };
    await addOneTenant(consumerTenant);

    const producerTenant = {
      ...getMockTenant(),
    };
    await addOneTenant(producerTenant);

    const agreement = {
      ...getMockAgreement(),
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);
    const messages = await handleAgreementRejected({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toEqual([]);
  });

  it("should generate one message to the consumer whose agreement was rejected", async () => {
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
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementRejected({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(1);
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

    const agreement = {
      ...getMockAgreement(),
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementRejected({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
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

    const oldMail = { ...getMockTenantMail(), createdAt: new Date(1999) };
    const newMail = getMockTenantMail();
    const consumerTenant = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(consumerTenant);

    const producerTenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(producerTenant);

    const agreement = {
      ...getMockAgreement(),
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementRejected({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(1);
    expect(messages[0].email.body).toContain("<!-- Title & Main Message -->");
    expect(messages[0].email.body).toContain("<!-- Footer -->");
    expect(messages[0].email.body).toContain(`Nuova richiesta di fruizione`);
    expect(messages[0].email.body).toContain(
      `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`
    );
    expect(messages[0].email.body).toContain(producerTenant.name);
    expect(messages[0].email.body).toContain(consumerTenant.name);
    expect(messages[0].email.body).toContain(eservice.name);
    expect(messages[0].email.body).toContain(descriptor.version);
  });
});
