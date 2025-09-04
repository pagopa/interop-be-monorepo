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
  agreementState,
  CorrelationId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
  UserId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { descriptorPublishedNotFound } from "../src/models/errors.js";
import { handleEserviceDescriptorPublished } from "../src/handlers/eservices/handleEserviceDescriptorPublished.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleNewEServiceDescriptorPublished", async () => {
  const descriptor = getMockDescriptorPublished();
  const eservice = {
    ...getMockEService(),
    descriptors: [descriptor],
  };
  await addOneEService(eservice);

  const { logger } = getMockContext({});

  await addOneEService(eservice);

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
      handleEserviceDescriptorPublished({
        eserviceV2Msg: toEServiceV2(eservice),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(descriptorPublishedNotFound(agreement.eserviceId));
  });

  it("should skip tenant when no emails exist for the tenant", async () => {
    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    const consumerTenant = getMockTenant(consumerId);
    await addOneTenant(consumerTenant);

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

  it("should generate no messages when no agreements exist for the eservice", async () => {
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
