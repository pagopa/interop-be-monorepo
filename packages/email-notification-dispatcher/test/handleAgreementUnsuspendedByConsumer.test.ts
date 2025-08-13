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
import { eServiceNotFound, tenantNotFound } from "../src/models/errors.js";
import { handleAgreementUnsuspendedByConsumer } from "../src/handlers/agreements/handleAgreementUnsuspendedByConsumer.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockUser,
  interopFeBaseUrl,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleAgreementUnsuspendedByConsumer", async () => {
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
      handleAgreementUnsuspendedByConsumer({
        agreementV2Msg: undefined,
        logger,
        interopFeBaseUrl,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "AgreementUnsuspendedByConsumer")
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
      handleAgreementUnsuspendedByConsumer({
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
      handleAgreementUnsuspendedByConsumer({
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
      handleAgreementUnsuspendedByConsumer({
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

  it("should generate one message per user of the tenant that produced the eservice", async () => {
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
      getMockUser(producerTenant.id),
      getMockUser(producerTenant.id),
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

    const messages = await handleAgreementUnsuspendedByConsumer({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(2);
    expect(messages[0].address).toEqual(users[0].email);
    expect(messages[1].address).toEqual(users[1].email);
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

    const messages = await handleAgreementUnsuspendedByConsumer({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      interopFeBaseUrl,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(1);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(`Nuova richiesta di fruizione`);
    });
  });
});
