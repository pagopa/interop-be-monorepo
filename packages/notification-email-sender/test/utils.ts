import axios, { AxiosResponse } from "axios";
import {
  buildHTMLTemplateService,
  EmailManagerSES,
} from "pagopa-interop-commons";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Agreement, EService, Purpose, Tenant } from "pagopa-interop-models";
import { afterEach, inject, vi } from "vitest";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertEService,
  upsertPurpose,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { notificationEmailSenderServiceBuilder } from "../src/services/notificationEmailSenderService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const emailManagerConfig = inject("emailManagerConfig");
export const sesEmailManagerConfig = inject("sesEmailManagerConfig");

export const { cleanup, pecEmailManager, sesEmailManager, readModelDB } =
  await setupTestContainersVitest(
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
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

export const templateService = buildHTMLTemplateService();

export const sesEmailManagerFailure: EmailManagerSES = {
  kind: "SES",
  send: vi.fn().mockRejectedValue(new Error("Generic error during send email")),
};

export const sesEmailSenderData = {
  label: "ses_sender",
  mail: "ses_sender@test.com",
};

export const interopFeBaseUrl = "http://localhost/fe";

export const notificationEmailSenderService =
  notificationEmailSenderServiceBuilder(
    sesEmailManager,
    sesEmailSenderData,
    readModelService,
    templateService,
    interopFeBaseUrl
  );

export const notificationEmailSenderServiceFailure =
  notificationEmailSenderServiceBuilder(
    sesEmailManagerFailure,
    sesEmailSenderData,
    readModelService,
    templateService,
    interopFeBaseUrl
  );

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
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
