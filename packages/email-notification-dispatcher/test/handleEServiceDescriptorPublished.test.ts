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
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleEserviceDescriptorPublished } from "../src/handlers/handleEServiceDescriptorPublished.js";
import { tenantNotFound } from "../src/models/errors.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  interopFeBaseUrl,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleNewEServiceDescriptorPublished", async () => {
  const eservice = {
    ...getMockEService(),
    producerId: generateId<TenantId>(),
    descriptors: [getMockDescriptorPublished()],
  };

  const { logger } = getMockContext({});

  await addOneEService(eservice);

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceDescriptorPublished({
        eserviceV2Msg: undefined,
        logger,
        interopFeBaseUrl,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorPublished")
    );
  });

  it("should return empty array when no agreements exist for the eservice", async () => {
    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      interopFeBaseUrl,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toEqual([]);
  });

  it("should throw tenantNotFound when tenant is not found", async () => {
    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    await expect(() =>
      handleEserviceDescriptorPublished({
        eserviceV2Msg: toEServiceV2(eservice),
        logger,
        interopFeBaseUrl,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(consumerId));
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
      interopFeBaseUrl,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toEqual([]);
  });

  it("should generate one message per tenant", async () => {
    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    const consumerTenant = {
      ...getMockTenant(consumerId),
      mails: [getMockTenantMail(), getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      interopFeBaseUrl,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(1);
  });

  it("should generate a message using the latest mail registered per tenant", async () => {
    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    const oldMail = { ...getMockTenantMail(), createdAt: new Date(1999) };
    const newMail = getMockTenantMail();
    const consumerTenant = {
      ...getMockTenant(consumerId),
      mails: [oldMail, newMail],
    };
    await addOneTenant(consumerTenant);

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      interopFeBaseUrl,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(1);
    expect(messages[0].address).toEqual(newMail.address);
  });

  it("should generate a message that correctly imports the specified header and footer", async () => {
    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    const consumerTenant = {
      ...getMockTenant(consumerId),
      mails: [getMockTenantMail(), getMockTenantMail()],
    };
    await addOneTenant(consumerTenant);

    const messages = await handleEserviceDescriptorPublished({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      interopFeBaseUrl,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(1);
    expect(messages[0].email.body).toContain("<head>");
    expect(messages[0].email.body).toContain("Nuova versione di un e-service");
    expect(messages[0].email.body).toContain("<body");
    expect(messages[0].email.body).toContain("<!-- Footer -->");
  });
});
