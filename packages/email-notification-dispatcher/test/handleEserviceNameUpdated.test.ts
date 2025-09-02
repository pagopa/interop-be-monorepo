/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  CorrelationId,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { descriptorPublishedNotFound } from "../src/models/errors.js";
import { handleEserviceNameUpdated } from "../src/handlers/eservices/handleEserviceNameUpdated.js";
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

describe("handleEserviceNameUpdated", async () => {
  const producerId = generateId<TenantId>();
  const consumerIds = [generateId<TenantId>(), generateId<TenantId>()];
  const eserviceId = generateId<EServiceId>();

  const descriptor = getMockDescriptorPublished();
  const eservice = {
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
    for (const user of users) {
      await addOneUser(user);
    }
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockReturnValueOnce(
        users.map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceNameUpdated({
        eserviceV2Msg: undefined,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceNameUpdated")
    );
  });

  it("should throw descriptorPublishedNotFound when descriptor is not found", async () => {
    const eserviceNoDescriptor = { ...getMockEService(), descriptors: [] };
    await addOneEService(eserviceNoDescriptor);

    const agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: {},
      producerId: producerTenant.id,
      eserviceId: eserviceNoDescriptor.id,
      consumerId: consumerTenants[0].id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleEserviceNameUpdated({
        eserviceV2Msg: toEServiceV2(eserviceNoDescriptor),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(descriptorPublishedNotFound(agreement.eserviceId));
  });

  it("should skip event if no consumer is present for the eservice", async () => {
    const messages = await handleEserviceNameUpdated({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the consumers of the eservice", async () => {
    const agreements = consumerTenants.map((consumerTenant) => ({
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

    const messages = await handleEserviceNameUpdated({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(4);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      true
    );
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
        { userId: users[0].id, tenantId: users[0].tenantId },
        { userId: users[2].id, tenantId: users[2].tenantId },
      ]);

    const agreements = consumerTenants.map((consumerTenant) => ({
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

    const messages = await handleEserviceNameUpdated({
      eserviceV2Msg: toEServiceV2(eservice),
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
    expect(messages.some((message) => message.address === users[2].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[3].email)).toBe(
      false
    );
  });

  it("should generate a complete and correct message", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: {},
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenants[0].id,
    };
    await addOneAgreement(agreement);
    await addOneAgreement(agreement);

    const messages = await handleEserviceNameUpdated({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(4);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(
        `L'e-service <Vecchio Nome E-service> è stato rinominato`
      );
    });
  });
});
