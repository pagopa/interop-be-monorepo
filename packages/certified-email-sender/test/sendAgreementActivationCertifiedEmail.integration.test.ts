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
  Tenant,
  UserId,
  generateId,
  tenantMailKind,
  toAgreementV2,
} from "pagopa-interop-models";
import { afterEach, beforeAll, describe, expect, it, vi, vitest } from "vitest";
import Mail from "nodemailer/lib/mailer/index.js";
import { tenantDigitalAddressNotFound } from "../src/models/errors.js";
import {
  certifiedMailTemplateEventType,
  getFormattedAgreementStampDate,
} from "../src/services/certifiedEmailSenderService.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  certifiedEmailSenderService,
  interopFeBaseUrl,
  pecEmailManager,
  pecEmailSenderData,
  templateService,
} from "./utils.js";

beforeAll(() => {
  vitest.clearAllMocks();
});

afterEach(() => {
  vitest.clearAllMocks();
});

describe("sendAgreementActivatedCertifiedEmail", () => {
  it("should send an email to Producer and Consumer digital addresses", async () => {
    vi.spyOn(pecEmailManager, "send").mockResolvedValue(undefined);
    const consumerEmail = getMockTenantMail(tenantMailKind.DigitalAddress);
    const consumer: Tenant = {
      ...getMockTenant(),
      mails: [consumerEmail],
    };
    const producerEmail = getMockTenantMail(tenantMailKind.DigitalAddress);
    const producer: Tenant = {
      ...getMockTenant(),
      mails: [producerEmail],
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

    await certifiedEmailSenderService.sendAgreementActivatedCertifiedEmail(
      toAgreementV2(agreement),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${certifiedMailTemplateEventType.agreementActivationPEC}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const activationNotificationEmailTemplate = htmlTemplateBuffer.toString();

    const mailOptions: Mail.Options = {
      from: {
        name: pecEmailSenderData.label,
        address: pecEmailSenderData.mail,
      },
      subject: `Richiesta di fruizione ${agreement.id} attiva`,
      to: [consumerEmail.address, producerEmail.address],
      html: templateService.compileHtml(activationNotificationEmailTemplate, {
        activationDate: getFormattedAgreementStampDate(agreement, "activation"),
        agreementId: agreement.id,
        eserviceName: eservice.name,
        eserviceVersion: descriptor.version,
        producerName: producer.name,
        consumerName: consumer.name,
        interopFeUrl: interopFeBaseUrl,
      }),
    };
    expect(pecEmailManager.send).toHaveBeenCalledTimes(1);
    expect(pecEmailManager.send).toHaveBeenCalledWith(
      mailOptions,
      expect.anything()
    );
  });

  it("should throw tenantDigitalAddressNotFound for Producer digital address not found", async () => {
    const producer = { ...getMockTenant(), mails: [] };

    await addOneTenant(producer);

    const consumer = {
      ...getMockTenant(),
      mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
    };
    await addOneTenant(consumer);

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
      certifiedEmailSenderService.sendAgreementActivatedCertifiedEmail(
        toAgreementV2(agreement),
        genericLogger
      )
    ).rejects.toThrowError(tenantDigitalAddressNotFound(agreement.producerId));

    expect(pecEmailManager.send).not.toHaveBeenCalled();
  });
});
