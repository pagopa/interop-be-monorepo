/* eslint-disable no-irregular-whitespace */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  EService,
  Tenant,
  UserId,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import axios, { AxiosResponse } from "axios";
import Mail from "nodemailer/lib/mailer/index.js";
import {
  eventMailTemplateType,
  getFormattedAgreementStampDate,
} from "../src/services/notificationEmailSenderService.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  notificationEmailSenderService,
  interopFeBaseUrl,
  sesEmailManager,
  sesEmailManagerConfig,
  sesEmailSenderData,
  templateService,
} from "./utils.js";

describe("sendAgreementSubmittedEmail", () => {
  it("should send an email on AgreementSubmitted", async () => {
    vi.spyOn(sesEmailManager, "send");
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

    const submissionDate = new Date("2021-01-01");

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

    await notificationEmailSenderService.sendAgreementSubmittedEmail(
      toAgreementV2(agreement),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.agreementSubmittedMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const submissionEmailTemplate = htmlTemplateBuffer.toString();

    const mailOptions: Mail.Options = {
      from: {
        name: sesEmailSenderData.label,
        address: sesEmailSenderData.mail,
      },
      subject: `Nuova richiesta di fruizione per ${eservice.name} ricevuta`,
      to: [tenantMail],
      html: templateService.compileHtml(submissionEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/richieste/${agreement.id}`,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        submissionDate: getFormattedAgreementStampDate(agreement, "submission"),
      }),
    };

    expect(sesEmailManager.send).toHaveBeenCalledWith(
      mailOptions,
      expect.anything()
    );

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    const lastEmail = response.data.emails[0];
    expect(lastEmail.body.html).toContain(mailOptions.html);
    expect(lastEmail).toMatchObject({
      subject: mailOptions.subject,
      from: `"${sesEmailSenderData.label}" <${sesEmailSenderData.mail}>`,
      destination: { to: mailOptions.to },
    });
  });

  it("should should not send email if the producer has no mail", async () => {
    vi.spyOn(sesEmailManager, "send");
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
    const agreement: Agreement = {
      ...getMockAgreement(),
      stamps: { submission: { when: new Date(), who: generateId<UserId>() } },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await notificationEmailSenderService.sendAgreementSubmittedEmail(
      toAgreementV2(agreement),
      genericLogger
    );

    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });
});
