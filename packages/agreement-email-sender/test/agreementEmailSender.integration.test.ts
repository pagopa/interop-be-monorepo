import { describe, expect, it, vi } from "vitest";
import axios from "axios";
import {
  AgreementId,
  DescriptorId,
  EServiceId,
  TenantId,
  UserId,
  generateId,
  genericInternalError,
  toAgreementV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { InstitutionResponse } from "pagopa-interop-selfcare-v2-client";
import { sendAgreementEmail } from "../src/services/agreementEmailSenderService.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  emailManager,
  emailManagerConfig,
  readModelService,
  selfcareV2ClientMock,
} from "./utils.js";

describe("agreement email sender", () => {
  it("should send an email on AgreementSubmitted", async () => {
    const tenant = { ...getMockTenant(), name: "Tenant" };
    await addOneTenant(tenant);
    const agreementId = unsafeBrandId<DescriptorId>(
      "a8f059b2-3931-4802-ad9d-203936e98c22"
    );
    const descriptror = { ...getMockDescriptor(), version: "1" };
    const eservice = {
      ...getMockEService(),
      name: "eService",
      descriptors: [descriptror],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(eservice.id, tenant.id),
      id: unsafeBrandId<AgreementId>(agreementId),
      stamps: { activation: { when: new Date(0), who: generateId<UserId>() } },
      producerId: tenant.id,
      descriptorId: descriptror.id,
    };
    await addOneAgreement(agreement);

    await sendAgreementEmail(
      toAgreementV2(agreement),
      readModelService,
      selfcareV2ClientMock,
      emailManager
    );

    const expectedBody = `<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body>
    <div style="white-space: pre-line;">
        Buongiorno,

        questa è una notifica automatica, si prega di non rispondere.

        In data 01/01/1970, PDND Interoperabilità ha registrato l'attivazione di una nuova richiesta di
        fruizione. Di seguito i dettagli:
        - Id della richiesta: a8f059b2-3931-4802-ad9d-203936e98c22
        - E-service: eService, versione: 1
        - Erogatore: Tenant
        - Fruitore: Tenant

        È possibile visionare la richiesta facendo accesso al <a href="https://selfcare.pagopa.it">backoffice</a>.

        Un saluto

        Team PDND Interoperabilità
    </div>

</body>

</html>
`;

    const { data } = await axios.get(
      `http://${emailManagerConfig?.emailManagerHost}:${emailManagerConfig?.emailManagerHTTPPort}/api/v1/message/latest`
    );

    const html = data.HTML.replace(/\r\n/g, "\n");
    expect(html).toBe(expectedBody);
    expect(data.From.Address).toBe(emailManagerConfig?.emailManagerSender);
    expect(data.To[0].Address).toBe("test@test.com");
  });

  it("should throw internalGenericError for activation date not found", async () => {
    const tenant = { ...getMockTenant(), name: "Tenant" };
    await addOneTenant(tenant);
    const agreementId = unsafeBrandId<DescriptorId>(
      "a8f059b2-3931-4802-ad9d-203936e98c22"
    );
    const descriptror = { ...getMockDescriptor(), version: "1" };
    const eservice = {
      ...getMockEService(),
      name: "eService",
      descriptors: [descriptror],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(eservice.id, tenant.id),
      id: unsafeBrandId<AgreementId>(agreementId),
      stamps: {},
      producerId: tenant.id,
      descriptrorId: descriptror.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementEmail(
        toAgreementV2(agreement),
        readModelService,
        selfcareV2ClientMock,
        emailManager
      )
    ).rejects.toThrowError(
      genericInternalError(
        "Activation date not found for agreement a8f059b2-3931-4802-ad9d-203936e98c22"
      )
    );
  });

  it("should throw internalGenericError for Eservice not found", async () => {
    const tenant = { ...getMockTenant(), name: "Tenant" };
    await addOneTenant(tenant);
    const agreementId = unsafeBrandId<DescriptorId>(
      "a8f059b2-3931-4802-ad9d-203936e98c22"
    );
    const agreement = {
      ...getMockAgreement(generateId<EServiceId>(), tenant.id),
      id: unsafeBrandId<AgreementId>(agreementId),
      stamps: { activation: { when: new Date(0), who: generateId<UserId>() } },
      producerId: tenant.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementEmail(
        toAgreementV2(agreement),
        readModelService,
        selfcareV2ClientMock,
        emailManager
      )
    ).rejects.toThrowError(
      genericInternalError(
        "EService not found for agreement a8f059b2-3931-4802-ad9d-203936e98c22"
      )
    );
  });

  it("should throw internalGenericError for Producer not found", async () => {
    const tenant = { ...getMockTenant(), name: "Tenant" };
    await addOneTenant(tenant);
    const agreementId = unsafeBrandId<DescriptorId>(
      "a8f059b2-3931-4802-ad9d-203936e98c22"
    );
    const descriptror = { ...getMockDescriptor(), version: "1" };
    const eservice = {
      ...getMockEService(),
      name: "eService",
      descriptors: [descriptror],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(eservice.id, tenant.id),
      id: unsafeBrandId<AgreementId>(agreementId),
      stamps: { activation: { when: new Date(0), who: generateId<UserId>() } },
      producerId: generateId<TenantId>(),
      descriptrorId: descriptror.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementEmail(
        toAgreementV2(agreement),
        readModelService,
        selfcareV2ClientMock,
        emailManager
      )
    ).rejects.toThrowError(
      genericInternalError(
        "Produce tenant not found for agreement a8f059b2-3931-4802-ad9d-203936e98c22"
      )
    );
  });

  it("should throw internalGenericError for Consumer not found", async () => {
    const tenant = { ...getMockTenant(), name: "Tenant" };
    await addOneTenant(tenant);
    const agreementId = unsafeBrandId<DescriptorId>(
      "a8f059b2-3931-4802-ad9d-203936e98c22"
    );
    const descriptror = { ...getMockDescriptor(), version: "1" };
    const eservice = {
      ...getMockEService(),
      name: "eService",
      descriptors: [descriptror],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(eservice.id, tenant.id),
      id: unsafeBrandId<AgreementId>(agreementId),
      stamps: { activation: { when: new Date(0), who: generateId<UserId>() } },
      producerId: tenant.id,
      consumerId: generateId<TenantId>(),
      descriptrorId: descriptror.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementEmail(
        toAgreementV2(agreement),
        readModelService,
        selfcareV2ClientMock,
        emailManager
      )
    ).rejects.toThrowError(
      genericInternalError(
        "Consumer tenant not found for agreement a8f059b2-3931-4802-ad9d-203936e98c22"
      )
    );
  });

  it("should throw internalGenericError for Producer email not found", async () => {
    const tenant = { ...getMockTenant(), name: "Tenant" };
    await addOneTenant(tenant);
    const agreementId = unsafeBrandId<DescriptorId>(
      "a8f059b2-3931-4802-ad9d-203936e98c22"
    );
    const descriptror = { ...getMockDescriptor(), version: "1" };
    const eservice = {
      ...getMockEService(),
      name: "eService",
      descriptors: [descriptror],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(eservice.id, tenant.id),
      id: unsafeBrandId<AgreementId>(agreementId),
      stamps: { activation: { when: new Date(0), who: generateId<UserId>() } },
      producerId: tenant.id,
      descriptrorId: descriptror.id,
    };
    await addOneAgreement(agreement);

    // eslint-disable-next-line functional/immutable-data
    selfcareV2ClientMock.getInstitution = vi.fn(
      async () => ({} as Promise<InstitutionResponse>)
    );

    await expect(
      sendAgreementEmail(
        toAgreementV2(agreement),
        readModelService,
        selfcareV2ClientMock,
        emailManager
      )
    ).rejects.toThrowError(
      genericInternalError(
        "Producer digital address not found for agreement a8f059b2-3931-4802-ad9d-203936e98c22"
      )
    );
  });
});
