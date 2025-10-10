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
  Agreement,
  agreementState,
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  const eservice: EService = {
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
      .mockImplementation((tenantIds, _notificationType) =>
        users
          .filter((user) => tenantIds.includes(user.tenantId))
          .map((user) => ({ userId: user.id, tenantId: user.tenantId }))
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
    const oldName = "Old name";
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

    const messages = await handleEserviceNameUpdated({
      eserviceV2Msg: toEServiceV2(eservice),
      oldName,
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
        `L&#x27;e-service ${oldName} è stato rinominato`
      );
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(consumerTenants[0].name);
      expect(message.email.body).toContain(oldName);
      expect(message.email.body).toContain(`Accedi per visualizzare`);
    });
  });
});
