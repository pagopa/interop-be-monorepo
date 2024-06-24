/* eslint-disable no-irregular-whitespace */
import { describe, expect, it } from "vitest";
import {
  EService,
  Tenant,
  UserId,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { sendAgreementSubmissionMail } from "../src/services/agreementEmailSenderService.js";
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

describe("sendAgreementSubmissionEmail", () => {
  it("should send an email on AgreementSubmitted", async () => {
    const tenantMail = "tenant@mail.com";
    const consumer: Tenant = { ...getMockTenant(), name: "Jane Doe" };
    const producer: Tenant = {
      ...getMockTenant(),
      name: "John Doe",
      mails: [
        {
          address: "oldmail@old.com",
          id: generateId(),
          createdAt: new Date("2021-01-01"),
          kind: "CONTACT_EMAIL",
        },
        {
          address: tenantMail,
          id: generateId(),
          createdAt: new Date(),
          kind: "CONTACT_EMAIL",
        },
        {
          address: "oldmail2@old.com",
          id: generateId(),
          createdAt: new Date("2020-01-01"),
          kind: "CONTACT_EMAIL",
        },
      ],
    };
    await addOneTenant(producer);
    await addOneTenant(consumer);

    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const submissionDate = new Date();

    const agreement = {
      ...getMockAgreement(),
      stamps: {
        submission: { when: submissionDate, who: generateId<UserId>() },
      },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await sendAgreementSubmissionMail(
      toAgreementV2(agreement),
      readModelService,
      emailManager,
      genericLogger
    );

    const messagesResponse = await getMails();

    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.data.messages.length).toBe(1);

    const { data: latestMail } = await getLatestMail();

    const html = latestMail.HTML.replace(/\r\n/g, "\n");
    expect(html).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html lang="it">

      <head>
          <meta charset="UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>

      <body>
          <div style="white-space: pre-line;">
              Gentile John Doe,

              ti informiamo che per l'e-service <strong>EService</strong>,

              Ã¨ presente una richiesta di fruizione da parte di <strong>Jane Doe</strong>, del giorno <strong>24/06/2024</strong>.

              <a href="https://selfcare.pagopa.it">Accedi per visualizzare</a>

              La visualizzazione dei dettagli Ã¨ disponibile previa autenticazione al portale.

              A presto,
              Il team di PDND InteroperabilitÃ 
          </div>

      </body>

      </html>
      "
    `);

    expect(latestMail.From.Address).toBe(config.awsSesAgreementEmailSender);
    expect(latestMail.To[0].Address).toBe(tenantMail);
  });

  it("should should not send email if the producer has no mail", async () => {
    const consumer: Tenant = { ...getMockTenant(), name: "Jane Doe" };
    const producer: Tenant = {
      ...getMockTenant(),
      name: "John Doe",
      mails: [],
    };
    await addOneTenant(producer);
    await addOneTenant(consumer);

    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(),
      stamps: { submission: { when: new Date(), who: generateId<UserId>() } },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await sendAgreementSubmissionMail(
      toAgreementV2(agreement),
      readModelService,
      emailManager,
      genericLogger
    );

    const messagesResponse = await getMails();

    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.data.messages.length).toBe(0);
  });
});
