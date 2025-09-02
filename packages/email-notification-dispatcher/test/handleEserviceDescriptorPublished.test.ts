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
  generateId,
  missingKafkaMessageDataError,
  Tenant,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { descriptorPublishedNotFound } from "../src/models/errors.js";
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

  it("should throw descriptorPublishedNotFound when descriptor is not found", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);

    const consumerTenant: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const producerTenant: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(producerTenant);

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

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toEqual([]);
  });
});
