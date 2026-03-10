import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import axios, { AxiosResponse } from "axios";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  UserId,
  generateId,
  tenantMailKind,
  toAgreementV2,
} from "pagopa-interop-models";
import { afterEach, beforeAll, describe, expect, it, vi, vitest } from "vitest";
import Mail from "nodemailer/lib/mailer/index.js";
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import {
  eventMailTemplateType,
  getFormattedAgreementStampDate,
} from "../src/services/notificationEmailSenderService.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  notificationEmailSenderService,
  notificationEmailSenderServiceFailure,
  interopFeBaseUrl,
  sesEmailManager,
  sesEmailManagerConfig,
  sesEmailSenderData,
  templateService,
} from "./utils.js";

beforeAll(() => {
  vitest.clearAllMocks();
});

afterEach(() => {
  vitest.clearAllMocks();
});

describe("sendAgreementActivatedEmail", () => {
  it("should send an email to Consumer to contact email addresses", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumerEmail = getMockTenantMail(tenantMailKind.ContactEmail);
    const consumer: Tenant = {
      ...getMockTenant(),
      mails: [consumerEmail],
    };
    const producer: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
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

    await notificationEmailSenderService.sendAgreementActivatedEmail(
      toAgreementV2(agreement),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${eventMailTemplateType.agreementActivatedMailTemplate}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const activationNotificationEmailTemplate = htmlTemplateBuffer.toString();

    const mailOptions: Mail.Options = {
      from: {
        name: sesEmailSenderData.label,
        address: sesEmailSenderData.mail,
      },
      subject: `Richiesta di fruizione ${agreement.id} attiva`,
      to: [consumerEmail.address],
      html: templateService.compileHtml(activationNotificationEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        activationDate: getFormattedAgreementStampDate(agreement, "activation"),
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

  it("should throw agreementStampDateNotFound for activation date not found", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };
    const producer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };

    const descriptor = getMockDescriptor();
    const eservice = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(),
      stamps: {},
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    await expect(
      notificationEmailSenderService.sendAgreementActivatedEmail(
        toAgreementV2(agreement),
        genericLogger
      )
    ).rejects.toThrowError(
      agreementStampDateNotFound("activation", agreement.id)
    );
    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });

  it("should throw eServiceNotFound for Eservice not found", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };
    const producer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producer.id,
      consumerId: consumer.id,
    };
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    await expect(
      notificationEmailSenderService.sendAgreementActivatedEmail(
        toAgreementV2(agreement),
        genericLogger
      )
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));

    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });

  it("should throw tenantNotFound for Producer not found", async () => {
    vi.spyOn(sesEmailManager, "send");
    const eservice = getMockEService();
    const consumer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };
    const producer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };
    await addOneEService(eservice);
    const agreement = {
      ...getMockAgreement(),
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      eserviceId: eservice.id,
      consumerId: consumer.id,
      producerId: producer.id,
    };

    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    await expect(
      notificationEmailSenderService.sendAgreementActivatedEmail(
        toAgreementV2(agreement),
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(agreement.producerId));
    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });

  it("should throw tenantNotFound for Consumer not found", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };
    const producer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };
    await addOneTenant(producer);

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
      notificationEmailSenderService.sendAgreementActivatedEmail(
        toAgreementV2(agreement),
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(agreement.consumerId));

    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });

  it("should throw descriptorNotFound for Descriptor not found", async () => {
    vi.spyOn(sesEmailManager, "send");
    const producer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
    };
    const consumer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
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
      notificationEmailSenderService.sendAgreementActivatedEmail(
        toAgreementV2(agreement),
        genericLogger
      )
    ).rejects.toThrowError(
      descriptorNotFound(agreement.eserviceId, agreement.descriptorId)
    );

    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });

  it("should fail when email manager send fails", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumer: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          ...getMockTenantMail(tenantMailKind.ContactEmail),
          address: "invalid email address",
        },
      ],
    };
    const producer: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          ...getMockTenantMail(tenantMailKind.ContactEmail),
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
      notificationEmailSenderServiceFailure.sendAgreementActivatedEmail(
        toAgreementV2(agreement),
        genericLogger
      )
    ).rejects.toThrow();

    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });
});
