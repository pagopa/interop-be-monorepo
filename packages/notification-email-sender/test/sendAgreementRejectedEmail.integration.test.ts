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
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  EService,
  Tenant,
  UserId,
  generateId,
  tenantMailKind,
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

describe("sendAgreementRejectedEmail", () => {
  it("should send an email on AgreementRejected", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumerEmail = getMockTenantMail(tenantMailKind.ContactEmail);
    const consumer: Tenant = {
      ...getMockTenant(),
      name: "Jane Doe",
      mails: [consumerEmail],
    };
    const producer: Tenant = getMockTenant();

    await addOneTenant(producer);
    await addOneTenant(consumer);

    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const rejectDate = new Date("2021-01-01");

    const agreement = {
      ...getMockAgreement(),
      stamps: {
        rejection: { when: rejectDate, who: generateId<UserId>() },
      },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await notificationEmailSenderService.sendAgreementRejectedEmail(
      toAgreementV2(agreement),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.agreementRejectedMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const rejectEmailTemplate = htmlTemplateBuffer.toString();

    const mailOptions: Mail.Options = {
      from: {
        name: sesEmailSenderData.label,
        address: sesEmailSenderData.mail,
      },
      subject: `Richiesta di fruizione per ${eservice.name} rifiutata`,
      to: [consumerEmail.address],
      html: templateService.compileHtml(rejectEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        rejectionDate: getFormattedAgreementStampDate(agreement, "rejection"),
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

  it("should not send email if the producer has no mail", async () => {
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
      stamps: { rejection: { when: new Date(), who: generateId<UserId>() } },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await notificationEmailSenderService.sendAgreementRejectedEmail(
      toAgreementV2(agreement),
      genericLogger
    );

    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });
});
