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
  EService,
  Purpose,
  Tenant,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelPurpose,
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterEach, inject, vi } from "vitest";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { notificationEmailSenderServiceBuilder } from "../src/services/notificationEmailSenderService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { config } from "../src/config/config.js";

export const emailManagerConfig = inject("emailManagerConfig");
export const sesEmailManagerConfig = inject("sesEmailManagerConfig");

export const {
  cleanup,
  readModelRepository,
  pecEmailManager,
  sesEmailManager,
  readModelDB,
} = await setupTestContainersVitest(
  inject("readModelConfig"),
  undefined,
  undefined,
  emailManagerConfig,
  undefined,
  sesEmailManagerConfig,
  inject("readModelSQLConfig")
);

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);

const readModelServiceSQL = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const templateService = buildHTMLTemplateService();

export const sesEmailManagerFailure: EmailManagerSES = {
  kind: "SES",
  send: vi.fn().mockRejectedValue(new Error("Generic error during send email")),
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

  await tenantReadModelServiceSQL.upsertTenant(tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(
    toReadModelAgreement(agreement),
    readModelRepository.agreements
  );

  await agreementReadModelServiceSQL.upsertAgreement(agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(
    toReadModelEService(eservice),
    readModelRepository.eservices
  );

  await catalogReadModelServiceSQL.upsertEService(eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(
    toReadModelPurpose(purpose),
    readModelRepository.purposes
  );

  await purposeReadModelServiceSQL.upsertPurpose(purpose, 0);
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
