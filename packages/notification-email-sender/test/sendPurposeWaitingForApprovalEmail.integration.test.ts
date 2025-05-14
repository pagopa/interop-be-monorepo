/* eslint-disable no-irregular-whitespace */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  EService,
  generateId,
  Purpose,
  PurposeId,
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
  sesEmailsenderData,
  templateService,
  addOnePurpose,
} from "./utils.js";

describe("sendPurposeWaitingForApprovalEmail", () => {
  it("should send an email to Consumer to contact email addresses", async () => {
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
      id: generateId<PurposeId>(),
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOnePurpose(purpose);

    await notificationEmailSenderService.sendPurposeWaitingForApprovalEmail(
      toPurposeV2(purpose),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.purposeWaitingForApprovalMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const aboveTheThresholdEmailTemplate = htmlTemplateBuffer.toString();

    const mailOptions: Mail.Options = {
      from: {
        name: sesEmailsenderData.label,
        address: sesEmailsenderData.mail,
      },
      subject: `Richiesta di attivazione della stima di carico sopra soglia per ${eservice.name}`,
      to: [consumerEmail.address],
      html: templateService.compileHtml(aboveTheThresholdEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/finalita/${purpose.id}`,
        eserviceName: eservice.name,
      }),
    };

    expect(sesEmailManager.send).toHaveBeenCalledWith(mailOptions);

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    const lastEmail = response.data.emails[0];
    expect(lastEmail.body.html).toContain(mailOptions.html);
    expect(lastEmail).toMatchObject({
      subject: mailOptions.subject,
      from: `"${sesEmailsenderData.label}" <${sesEmailsenderData.mail}>`,
      destination: { to: mailOptions.to },
    });
  });
});
