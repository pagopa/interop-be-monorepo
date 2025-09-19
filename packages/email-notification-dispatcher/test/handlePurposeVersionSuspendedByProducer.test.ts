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
  missingKafkaMessageDataError,
  Purpose,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  toPurposeV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eServiceNotFound, tenantNotFound } from "../src/models/errors.js";
import { handlePurposeVersionSuspendedByProducer } from "../src/handlers/purposes/handlePurposeVersionSuspendedByProducer.js";
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

describe("handlePurposeVersionSuspendedByProducer", async () => {
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
  const producerTenant = getMockTenant(producerId);
  const consumerTenant: Tenant = {
    ...getMockTenant(consumerId),
    mails: [getMockTenantMail()],
  };
  const users = [
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
      .mockReturnValueOnce(
        users.map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw missingKafkaMessageDataError when purpose is undefined", async () => {
    await expect(() =>
      handlePurposeVersionSuspendedByProducer({
        purposeV2Msg: undefined,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "purpose",
        "PurposeVersionSuspendedByProducer"
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
      handlePurposeVersionSuspendedByProducer({
        purposeV2Msg: toPurposeV2(purpose),
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

    const eserviceWithUnknownProducer: EService = {
      ...getMockEService(),
      producerId: unkonwnProducerId,
    };
    await addOneEService(eserviceWithUnknownProducer);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eserviceWithUnknownProducer.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    await expect(() =>
      handlePurposeVersionSuspendedByProducer({
        purposeV2Msg: toPurposeV2(purpose),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unkonwnProducerId));
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
      handlePurposeVersionSuspendedByProducer({
        purposeV2Msg: toPurposeV2(purpose),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(unknownEServiceId));
  });

  it("should generate one message per user of the tenant that consumed the eservice", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handlePurposeVersionSuspendedByProducer({
      purposeV2Msg: toPurposeV2(purpose),
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

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        { userId: users[0].id, tenantId: users[0].tenantId },
      ]);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handlePurposeVersionSuspendedByProducer({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      false
    );
  });

  it("should generate one message to the consumer whose agreement was rejected", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handlePurposeVersionSuspendedByProducer({
      purposeV2Msg: toPurposeV2(purpose),
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
    const consumerTenantWithMultipleMails: Tenant = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(consumerTenantWithMultipleMails);

    const purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenantWithMultipleMails.id,
    };
    await addOnePurpose(purpose);

    const messages = await handlePurposeVersionSuspendedByProducer({
      purposeV2Msg: toPurposeV2(purpose),
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

  it("should not generate a message to the consumer if they disabled email notification", async () => {
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: consumerTenant.id,
        enabled: false,
        createAt: new Date(),
      });

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handlePurposeVersionSuspendedByProducer({
      purposeV2Msg: toPurposeV2(purpose),
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
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handlePurposeVersionSuspendedByProducer({
      purposeV2Msg: toPurposeV2(purpose),
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
      expect(message.email.body).toContain(
        `Sospensione della finalità &quot;${purpose.title}&quot;`
      );
      expect(message.email.body).toContain(producerTenant.name);
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(purpose.title);
    });
  });
});
