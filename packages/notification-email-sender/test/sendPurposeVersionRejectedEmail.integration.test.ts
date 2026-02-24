/* eslint-disable no-irregular-whitespace */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  purposeVersionState,
  Tenant,
  tenantMailKind,
  toPurposeV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import axios, { AxiosResponse } from "axios";
import Mail from "nodemailer/lib/mailer/index.js";
import { eventMailTemplateType } from "../src/services/notificationEmailSenderService.js";
import {
  addOneEService,
  addOneTenant,
  notificationEmailSenderService,
  interopFeBaseUrl,
  sesEmailManager,
  sesEmailManagerConfig,
  sesEmailSenderData,
  templateService,
  addOnePurpose,
} from "./utils.js";

describe("sendPurposeVersionRejectedEmail", () => {
  it("should send a first purpose version rejected mail to the consumer's email addresses", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumerEmail = getMockTenantMail(tenantMailKind.ContactEmail);
    const consumer: Tenant = {
      ...getMockTenant(),
      name: "Jane Doe",
      mails: [consumerEmail],
    };

    await addOneTenant(consumer);

    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.waitingForApproval)],
    };
    await addOnePurpose(purpose);

    await notificationEmailSenderService.sendPurposeVersionRejectedEmail(
      toPurposeV2(purpose),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.firstPurposeVersionRejectedMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const aboveTheThresholdEmailTemplate = htmlTemplateBuffer.toString();

    const mailOptions: Mail.Options = {
      from: {
        name: sesEmailSenderData.label,
        address: sesEmailSenderData.mail,
      },
      subject: `Rifiuto della finalità da parte dell'erogatore`,
      to: [consumerEmail.address],
      html: templateService.compileHtml(aboveTheThresholdEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/finalita/${purpose.id}`,
        purposeName: purpose.title,
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

  it("should send an other purpose version rejected mail to the consumer's email addresses", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumerEmail = getMockTenantMail(tenantMailKind.ContactEmail);
    const consumer: Tenant = {
      ...getMockTenant(),
      name: "Jane Doe",
      mails: [consumerEmail],
    };

    await addOneTenant(consumer);

    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumer.id,
      versions: [getMockPurposeVersion(), getMockPurposeVersion()],
    };
    await addOnePurpose(purpose);

    await notificationEmailSenderService.sendPurposeVersionRejectedEmail(
      toPurposeV2(purpose),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.otherPurposeVersionRejectedMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const aboveTheThresholdEmailTemplate = htmlTemplateBuffer.toString();

    const mailOptions: Mail.Options = {
      from: {
        name: sesEmailSenderData.label,
        address: sesEmailSenderData.mail,
      },
      subject: `Rifiuto richiesta di adeguamento stime di carico`,
      to: [consumerEmail.address],
      html: templateService.compileHtml(aboveTheThresholdEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/finalita/${purpose.id}`,
        purposeName: purpose.title,
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
});
