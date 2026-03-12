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
  EServiceId,
  generateId,
  Purpose,
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

describe("sendNewPurposeVersionWaitingForApprovalEmail", () => {
  it("should send an email to Producer to contact email addresses", async () => {
    vi.spyOn(sesEmailManager, "send");
    const producerEmail = getMockTenantMail(tenantMailKind.ContactEmail);
    const producer: Tenant = {
      ...getMockTenant(),
      name: "Jane Doe",
      mails: [producerEmail],
    };

    await addOneTenant(producer);

    const descriptor = getMockDescriptor();
    const eservice: EService = getMockEService(
      generateId<EServiceId>(),
      producer.id,
      [descriptor]
    );
    await addOneEService(eservice);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: producer.id,
    };
    await addOnePurpose(purpose);

    await notificationEmailSenderService.sendNewPurposeVersionWaitingForApprovalEmail(
      toPurposeV2(purpose),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.newPurposeVersionWaitingForApprovalMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const aboveTheThresholdEmailTemplate = htmlTemplateBuffer.toString();

    const mailOptions: Mail.Options = {
      from: {
        name: sesEmailSenderData.label,
        address: sesEmailSenderData.mail,
      },
      subject: `Richiesta di variazione della stima di carico per ${eservice.name}`,
      to: [producerEmail.address],
      html: templateService.compileHtml(aboveTheThresholdEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/finalita/${purpose.id}`,
        purposeName: purpose.title,
        eserviceName: eservice.name,
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
