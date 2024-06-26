import { describe, expect, it } from "vitest";
import {
  Tenant,
  UserId,
  generateId,
  tenantMailKind,
  toAgreementV2,
} from "pagopa-interop-models";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import { dateAtRomeZone, genericLogger } from "pagopa-interop-commons";
import { sendAgreementActivationEmail } from "../src/services/agreementEmailSenderService.js";
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  tenantDigitalAddressNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  config,
  emailManager,
  getLatestMail,
  getMails,
  readModelService,
} from "./utils.js";

describe("sendAgreementActivationEmail", () => {
  it("should send an email", async () => {
    const consumer: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
    };
    const producer: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);

    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await sendAgreementActivationEmail(
      toAgreementV2(agreement),
      readModelService,
      emailManager,
      genericLogger
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

        In data ${dateAtRomeZone(
          agreement.stamps.activation.when
        )}, PDND Interoperabilità ha registrato l'attivazione di una nuova richiesta di
        fruizione. Di seguito i dettagli:
        - Id della richiesta: ${agreement.id}
        - E-service: ${eservice.name}, versione: ${descriptor.version}
        - Erogatore: ${producer.name}
        - Fruitore: ${consumer.name}

        È possibile visionare la richiesta facendo accesso al <a href="https://selfcare.pagopa.it">backoffice</a>.

        Un saluto

        Team PDND Interoperabilità
    </div>

</body>

</html>
`;

    const messagesResponse = await getMails();

    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.data.messages.length).toBe(1);

    const { data: latestMail } = await getLatestMail();

    const html = latestMail.HTML.replace(/\r\n/g, "\n");
    expect(html).toBe(expectedBody);
    expect(latestMail.From.Address).toBe(config.pecSenderMail);
    expect(latestMail.To[0].Address).toBe(producer.mails[0].address);
    expect(latestMail.To[1].Address).toBe(consumer.mails[0].address);
    expect(latestMail.Subject).toBe(
      `Richiesta di fruizione ${agreement.id} attiva`
    );
  });

  it("should throw agreementStampDateNotFound for activation date not found", async () => {
    const agreement = {
      ...getMockAgreement(),
      stamps: {},
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementActivationEmail(
        toAgreementV2(agreement),
        readModelService,
        emailManager,
        genericLogger
      )
    ).rejects.toThrowError(
      agreementStampDateNotFound("activation", agreement.id)
    );
  });

  it("should throw eServiceNotFound for Eservice not found", async () => {
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementActivationEmail(
        toAgreementV2(agreement),
        readModelService,
        emailManager,
        genericLogger
      )
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw tenantNotFound for Producer not found", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      eserviceId: eservice.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementActivationEmail(
        toAgreementV2(agreement),
        readModelService,
        emailManager,
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(agreement.producerId));
  });

  it("should throw tenantNotFound for Consumer not found", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);
    const eservice = getMockEService();
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      eserviceId: eservice.id,
      producerId: producer.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementActivationEmail(
        toAgreementV2(agreement),
        readModelService,
        emailManager,
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(agreement.consumerId));
  });

  it("should throw tenantDigitalAddressNotFound for Producer digital address not found", async () => {
    const producer = getMockTenant();
    const consumer = getMockTenant();
    await addOneTenant(producer);
    await addOneTenant(consumer);

    const eservice = getMockEService();
    await addOneEService(eservice);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      eserviceId: eservice.id,
      producerId: producer.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementActivationEmail(
        toAgreementV2(agreement),
        readModelService,
        emailManager,
        genericLogger
      )
    ).rejects.toThrowError(tenantDigitalAddressNotFound(agreement.producerId));
  });

  it("should throw tenantDigitalAddressNotFound for Consumer digital address not found", async () => {
    const producer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
    };
    const consumer = getMockTenant();
    await addOneTenant(producer);
    await addOneTenant(consumer);

    const eservice = getMockEService();
    await addOneEService(eservice);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      eserviceId: eservice.id,
      producerId: producer.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementActivationEmail(
        toAgreementV2(agreement),
        readModelService,
        emailManager,
        genericLogger
      )
    ).rejects.toThrowError(tenantDigitalAddressNotFound(agreement.consumerId));
  });

  it("should throw descriptorNotFound for Descriptor not found", async () => {
    const producer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
    };
    const consumer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
    };
    await addOneTenant(producer);
    await addOneTenant(consumer);

    const eservice = getMockEService();
    await addOneEService(eservice);

    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      eserviceId: eservice.id,
      producerId: producer.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementActivationEmail(
        toAgreementV2(agreement),
        readModelService,
        emailManager,
        genericLogger
      )
    ).rejects.toThrowError(
      descriptorNotFound(agreement.eserviceId, agreement.descriptorId)
    );
  });

  it("should fail when email manager send fails", async () => {
    const consumer: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          ...getMockTenantMail(tenantMailKind.DigitalAddress),
          address: "invalid email address",
        },
      ],
    };
    const producer: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          ...getMockTenantMail(tenantMailKind.DigitalAddress),
          address: "invalid email address",
        },
      ],
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);

    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await expect(
      sendAgreementActivationEmail(
        toAgreementV2(agreement),
        readModelService,
        emailManager,
        genericLogger
      )
    ).rejects.toThrowError("No recipients defined");
  });
});
