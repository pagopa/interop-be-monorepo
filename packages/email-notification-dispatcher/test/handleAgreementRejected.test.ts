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
  DescriptorId,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toAgreementV2,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateAtRomeZone } from "pagopa-interop-commons";
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import { handleAgreementRejected } from "../src/handlers/agreements/handleAgreementRejected.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleAgreementRejected", async () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();

  const descriptor = getMockDescriptorPublished();
  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    consumerId,
    descriptors: [descriptor],
  };
  const producerTenant = getMockTenant(producerId);
  const consumerTenant = {
    ...getMockTenant(consumerId),
    mails: [getMockTenantMail()],
  };
  const users = [
    getMockUser(consumerTenant.id),
    getMockUser(consumerTenant.id),
  ];

  const userService = {
    readUser: vi.fn(),
  };
  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockReturnValueOnce(
        users.map((user) => ({ userId: user.userId, tenantId: user.tenantId }))
      );
    userService.readUser.mockImplementation((userId) =>
      users.find((user) => user.userId === userId)
    );
  });

  it("should throw missingKafkaMessageDataError when agreement is undefined", async () => {
    await expect(() =>
      handleAgreementRejected({
        agreementV2Msg: undefined,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "AgreementRejected")
    );
  });

  it("should throw tenantNotFound when consumer is not found", async () => {
    const unknownConsumerId = generateId<TenantId>();

    const agreement = {
      ...getMockAgreement(),
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: unknownConsumerId,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementRejected({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownConsumerId));
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const unkonwnProducerId = generateId<TenantId>();

    const agreement = {
      ...getMockAgreement(),
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId: unkonwnProducerId,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementRejected({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unkonwnProducerId));
  });

  it("should throw agreementStampDateNotFound when rejection date is not found", async () => {
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
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(agreementStampDateNotFound("rejection", agreement.id));
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
      handleAgreementRejected({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(unknownEServiceId));
  });

  it("should throw descriptorNotFound when descriptor is not found", async () => {
    const agreement = {
      ...getMockAgreement(),
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      descriptorId: generateId<DescriptorId>(),
      producerId: producerTenant.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleAgreementRejected({
        agreementV2Msg: toAgreementV2(agreement),
        logger,
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
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(3);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      true
    );
  });

  it("should generate one message to the consumer whose agreement was rejected", async () => {
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
    const consumerTenant = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(consumerTenant);

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
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(3);
    expect(
      messages.some((message) => message.address === newMail.address)
    ).toBe(true);
  });

  it("should generate a complete and correct message", async () => {
    const rejectionDate = new Date();
    const agreement = {
      ...getMockAgreement(),
      stamps: { rejection: { when: rejectionDate, who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleAgreementRejected({
      agreementV2Msg: toAgreementV2(agreement),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(3);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain(`Nuova richiesta di fruizione`);
      expect(message.email.body).toContain(producerTenant.name);
      expect(message.email.body).toContain(consumerTenant.name);
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(descriptor.version);
      expect(message.email.body).toContain(dateAtRomeZone(rejectionDate));
    });
  });
});
