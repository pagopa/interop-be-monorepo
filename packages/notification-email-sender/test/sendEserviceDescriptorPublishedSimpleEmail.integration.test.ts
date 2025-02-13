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
  generateId,
  tenantMailKind,
  toEServiceV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import axios, { AxiosResponse } from "axios";
import { eventMailTemplateType } from "../src/services/notificationEmailSenderService.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  notificationEmailSenderService,
  interopFeBaseUrl,
  sesEmailManager,
  sesEmailManagerConfig,
  sesEmailsenderData,
  templateService,
} from "./utils.js";

describe("sendEserviceDescriptorPublishedSimpleEmail", () => {
  it("should send an email on EserviceDescriptorPublished", async () => {
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
    };

    const agreement2 = {
      ...getMockAgreement(),
      id: generateId<AgreementId>(),
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer2.id,
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);

    await notificationEmailSenderService.sendEserviceDescriptorPublishedSimpleEmail(
      toEServiceV2(eservice),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.eserviceDescriptorPublishedMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const eservicePublishedDescriptorEmailTemplate =
      htmlTemplateBuffer.toString();

    const mail1 = {
      from: {
        name: sesEmailsenderData.label,
        address: sesEmailsenderData.mail,
      },
      subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
      to: [consumerEmail1.address],
      body: templateService.compileHtml(
        eservicePublishedDescriptorEmailTemplate,
        {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/fruizione/catalogo-e-service/${eservice.id}/${descriptor}`,
          consumerName: consumer1.name,
          eserviceName: eservice.name,
        }
      ),
    };

    expect(sesEmailManager.send).toHaveBeenCalledWith(
      mail1.from,
      mail1.to,
      mail1.subject,
      mail1.body
    );

    const response1: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response1.status).toBe(200);
    const lastEmail1 = response1.data.emails[0];

    expect(lastEmail1).toMatchObject({
      subject: mail1.subject,
      from: `${mail1.from.name} <${mail1.from.address}>`,
      destination: { to: mail1.to },
      body: { html: mail1.body },
    });

    const mail2 = {
      from: {
        name: sesEmailsenderData.label,
        address: sesEmailsenderData.mail,
      },
      subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
      to: [consumerEmail2.address],
      body: templateService.compileHtml(
        eservicePublishedDescriptorEmailTemplate,
        {
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/fruizione/catalogo-e-service/${eservice.id}/${descriptor}`,
          consumerName: consumer2.name,
          eserviceName: eservice.name,
        }
      ),
    };

    expect(sesEmailManager.send).toHaveBeenCalledWith(
      mail2.from,
      mail2.to,
      mail2.subject,
      mail2.body
    );

    const response2: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response2.status).toBe(200);
    const lastEmail2 = response2.data.emails[1];

    expect(lastEmail2).toMatchObject({
      subject: mail2.subject,
      from: `${mail2.from.name} <${mail2.from.address}>`,
      destination: { to: mail2.to },
      body: { html: mail2.body },
    });
  });

  it("should not throw error if don't find the consumer mail", async () => {
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
    };

    await addOneAgreement(agreement1);

    await notificationEmailSenderService.sendEserviceDescriptorPublishedSimpleEmail(
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
