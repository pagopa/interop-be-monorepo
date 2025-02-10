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
  Purpose,
  Tenant,
  tenantMailKind,
  toPurposeV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import axios, { AxiosResponse } from "axios";
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

describe("sendNewPurposeVersionWaitingForApprovalEmail", () => {
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
      eserviceId: eservice.id,
      consumerId: consumer.id,
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

    const mail = {
      from: {
        name: sesEmailsenderData.label,
        address: sesEmailsenderData.mail,
      },
      subject: `Richiesta di variazione della stima di carico per ${eservice.name}`,
      to: [consumerEmail.address],
      body: templateService.compileHtml(aboveTheThresholdEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/finalita/${purpose.id}`,
        purposeName: purpose.title,
        eserviceName: eservice.name,
      }),
    };

    expect(sesEmailManager.send).toHaveBeenCalledWith(
      mail.from,
      mail.to,
      mail.subject,
      mail.body
    );

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    const lastEmail = response.data.emails[0];

    expect(lastEmail).toMatchObject({
      subject: mail.subject,
      from: `${mail.from.name} <${mail.from.address}>`,
      destination: { to: mail.to },
      body: { html: mail.body },
    });
  });
});
