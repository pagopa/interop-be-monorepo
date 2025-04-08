import {
  EmailManagerSES,
  genericLogger,
  AllowedSESErrors,
} from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  Descriptor,
  EService,
  Purpose,
  PurposeId,
  Tenant,
  UserId,
  agreementState,
  generateId,
  purposeVersionState,
  tenantMailKind,
  toAgreementV2,
  toEServiceV2,
  toPurposeV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi, vitest } from "vitest";
import axios, { AxiosResponse } from "axios";
import { notificationEmailSenderServiceBuilder } from "../src/services/notificationEmailSenderService.js";
import {
  addOneAgreement,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  interopFeBaseUrl,
  readModelService,
  sesEmailManagerConfig,
  sesEmailsenderData,
  templateService,
} from "./utils.js";

beforeAll(() => {
  vitest.clearAllMocks();
});

describe("TooManyRequests error skip notification", () => {
  const sesEmailManagerMock: EmailManagerSES = {
    kind: "SES",
    send: vi.fn().mockRejectedValue(
      new AllowedSESErrors({
        $metadata: {},
        message: "Too many requests",
      })
    ),
  };

  const notificationEmailSenderService = notificationEmailSenderServiceBuilder(
    sesEmailManagerMock,
    sesEmailsenderData,
    readModelService,
    templateService,
    interopFeBaseUrl
  );

  it("should consume message sendAgreementActivated without error", async () => {
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

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    expect(response.data.emails.length).toBe(0);
  });

  it("should consume message sendAgreementRejected without error", async () => {
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

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    expect(response.data.emails.length).toBe(0);
  });

  it("should consume message sendAgreementSubmitted without error", async () => {
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

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    expect(response.data.emails.length).toBe(0);
  });

  it("should consume message sendEserviceDescriptorPublished without error", async () => {
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

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    expect(response.data.emails.length).toBe(0);
  });

  it("should consume message sendNewPurposeVersionWaitingForApproval without error", async () => {
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

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    expect(response.data.emails.length).toBe(0);
  });

  it("should consume message sendPurposeVersionActivated without error", async () => {
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

    await notificationEmailSenderService.sendPurposeVersionActivatedEmail(
      toPurposeV2(purpose),
      genericLogger
    );

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    expect(response.data.emails.length).toBe(0);
  });

  it("should consume message sendPurposeVersionRejected without error", async () => {
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

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    expect(response.data.emails.length).toBe(0);
  });

  it("should consume message sendPurposeWaitingForApproval without error", async () => {
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

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    expect(response.data.emails.length).toBe(0);
  });
});
