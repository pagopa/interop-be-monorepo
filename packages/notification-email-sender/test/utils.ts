import axios, { AxiosResponse } from "axios";
import {
  buildHTMLTemplateService,
  EmailManagerSES,
} from "pagopa-interop-commons";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Delegation,
  EService,
  Purpose,
  Tenant,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelPurpose,
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterEach, inject, vi } from "vitest";
import { notificationEmailSenderServiceBuilder } from "../src/services/notificationEmailSenderService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const readModelConfig = inject("readModelConfig");
export const emailManagerConfig = inject("emailManagerConfig");
export const sesEmailManagerConfig = inject("sesEmailManagerConfig");

export const {
  cleanup,
  readModelRepository,
  pecEmailManager,
  sesEmailManager,
} = await setupTestContainersVitest(
  readModelConfig,
  undefined,
  undefined,
  emailManagerConfig,
  undefined,
  sesEmailManagerConfig
);
export const readModelService = readModelServiceBuilder(readModelRepository);
export const templateService = buildHTMLTemplateService();

export const sesEmailManagerFailure: EmailManagerSES = {
  kind: "SES",
  send: vi.fn().mockRejectedValue(new Error("Generic error during send email")),
  sendWithAttachments: vi
    .fn()
    .mockRejectedValue(new Error("Generic error during send email")),
};

export const sesEmailsenderData = {
  label: "ses_sender",
  mail: "ses_sender@test.com",
};

export const interopFeBaseUrl = "http://localhost/fe";

export const notificationEmailSenderService =
  notificationEmailSenderServiceBuilder(
    sesEmailManager,
    sesEmailsenderData,
    readModelService,
    templateService,
    interopFeBaseUrl
  );

export const notificationEmailSenderServiceFailure =
  notificationEmailSenderServiceBuilder(
    sesEmailManagerFailure,
    sesEmailsenderData,
    readModelService,
    templateService,
    interopFeBaseUrl
  );

export const agreements = readModelRepository.agreements;

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(
    toReadModelTenant(tenant),
    readModelRepository.tenants
  );
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(
    toReadModelAgreement(agreement),
    readModelRepository.agreements
  );
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(
    toReadModelEService(eservice),
    readModelRepository.eservices
  );
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(
    toReadModelPurpose(purpose),
    readModelRepository.purposes
  );
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, readModelRepository.delegations);
};

type Mail = {
  HTML: string;
  From: { Address: string };
  To: Array<{ Address: string }>;
  Subject: string;
};
export async function getLatestMail(): Promise<AxiosResponse<Mail>> {
  return await axios.get<Mail>(
    `http://${emailManagerConfig?.smtpAddress}:${emailManagerConfig?.mailpitAPIPort}/api/v1/message/latest`
  );
}

export async function getMails(): Promise<AxiosResponse<{ messages: Mail[] }>> {
  return await axios.get<{ messages: Mail[] }>(
    `http://${emailManagerConfig?.smtpAddress}:${emailManagerConfig?.mailpitAPIPort}/api/v1/messages`
  );
}

afterEach(cleanup);
