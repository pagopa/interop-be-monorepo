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
  AgreementId,
  Descriptor,
  EService,
  Tenant,
  agreementState,
  generateId,
  tenantMailKind,
  toEServiceV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import axios, { AxiosResponse } from "axios";
import Mail from "nodemailer/lib/mailer/index.js";
import { eventMailTemplateType } from "../src/services/notificationEmailSenderService.js";
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

describe("sendEserviceDescriptorPublishedEmail", () => {
  it("should send an email on EserviceDescriptorPublished when there're active agreements", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumerEmail1 = getMockTenantMail(tenantMailKind.ContactEmail);
    const consumerEmail2 = getMockTenantMail(tenantMailKind.ContactEmail);

    const consumer1: Tenant = {
      ...getMockTenant(),
      name: "Jane Doe",
      mails: [consumerEmail1],
    };

    const consumer2: Tenant = {
      ...getMockTenant(),
      name: "Jhon Smith",
      mails: [consumerEmail2],
    };

    await addOneTenant(consumer1);
    await addOneTenant(consumer2);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: "Published",
      version: "1",
    };

    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const agreement1 = {
      ...getMockAgreement(),
      id: generateId<AgreementId>(),
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer1.id,
      state: agreementState.active,
    };

    const agreement2 = {
      ...getMockAgreement(),
      id: generateId<AgreementId>(),
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer2.id,
      state: agreementState.suspended,
    };

    const agreement3 = {
      ...getMockAgreement(),
      id: generateId<AgreementId>(),
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer2.id,
      state: agreementState.archived,
    };

    const agreement4 = {
      ...getMockAgreement(),
      id: generateId<AgreementId>(),
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer2.id,
      state: agreementState.missingCertifiedAttributes,
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);
    await addOneAgreement(agreement3);
    await addOneAgreement(agreement4);

    await notificationEmailSenderService.sendEserviceDescriptorPublishedEmail(
      toEServiceV2(eservice),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.eserviceDescriptorPublishedMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const eservicePublishedDescriptorEmailTemplate =
      htmlTemplateBuffer.toString();

    const mailOptions1: Mail.Options = {
      from: {
        name: sesEmailSenderData.label,
        address: sesEmailSenderData.mail,
      },
      subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
      to: [consumerEmail1.address],
      html: templateService.compileHtml(
        eservicePublishedDescriptorEmailTemplate,
        {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${descriptor.id}`,
          consumerName: consumer1.name,
          eserviceName: eservice.name,
        }
      ),
    };

    expect(sesEmailManager.send).toHaveBeenCalledWith(
      mailOptions1,
      expect.anything()
    );

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);

    const emails = response.data.emails;

    const lastEmail1 = emails.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (email: any) =>
        email.destination.to.includes(consumerEmail1.address) &&
        email.subject === mailOptions1.subject
    );

    expect(lastEmail1).toBeDefined();
    expect(lastEmail1.body.html).toContain(mailOptions1.html);
    expect(lastEmail1).toMatchObject({
      subject: mailOptions1.subject,
      from: `"${sesEmailSenderData.label}" <${sesEmailSenderData.mail}>`,
      destination: { to: mailOptions1.to },
    });

    const mailOptions2: Mail.Options = {
      from: {
        name: sesEmailSenderData.label,
        address: sesEmailSenderData.mail,
      },
      subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
      to: [consumerEmail2.address],
      html: templateService.compileHtml(
        eservicePublishedDescriptorEmailTemplate,
        {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${descriptor.id}`,
          consumerName: consumer2.name,
          eserviceName: eservice.name,
        }
      ),
    };

    expect(sesEmailManager.send).toHaveBeenCalledWith(
      mailOptions2,
      expect.anything()
    );

    const lastEmail2 = emails.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (email: any) =>
        email.destination.to.includes(consumerEmail2.address) &&
        email.subject === mailOptions2.subject
    );

    expect(lastEmail2).toBeDefined();
    expect(lastEmail2.body.html).toContain(mailOptions2.html);
    expect(lastEmail2).toMatchObject({
      subject: mailOptions2.subject,
      from: `"${sesEmailSenderData.label}" <${sesEmailSenderData.mail}>`,
      destination: { to: mailOptions2.to },
    });
  });

  it("Shouldn't send an email if there are no active agreements", async () => {
    vi.spyOn(sesEmailManager, "send");

    const consumer1: Tenant = {
      ...getMockTenant(),
      name: "Jane Doe",
      mails: [],
    };

    await addOneTenant(consumer1);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: "Published",
      version: "1",
    };

    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const agreement1 = {
      ...getMockAgreement(),
      id: generateId<AgreementId>(),
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer1.id,
      state: agreementState.rejected,
    };

    await addOneAgreement(agreement1);

    await notificationEmailSenderService.sendEserviceDescriptorPublishedEmail(
      toEServiceV2(eservice),
      genericLogger
    );

    expect(sesEmailManager.send).toHaveBeenCalledTimes(0);

    const response1: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response1.status).toBe(200);
    const lastEmail1 = response1.data.emails;

    expect(lastEmail1).toMatchObject({});
  });
});
