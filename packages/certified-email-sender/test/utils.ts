import axios, { AxiosResponse } from "axios";
import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Agreement, EService, Tenant } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  catalogReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertEService,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { certifiedEmailSenderServiceBuilder } from "../src/services/certifiedEmailSenderService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const emailManagerConfig = inject("emailManagerConfig");

export const { cleanup, pecEmailManager, readModelDB } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    emailManagerConfig,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const readModelService = readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

export const templateService = buildHTMLTemplateService();

export const pecEmailSenderData = {
  label: "pec_sender",
  mail: "pec_sender@test.com",
};
export const interopFeBaseUrl = "http://localhost/fe";

export const certifiedEmailSenderService = certifiedEmailSenderServiceBuilder(
  pecEmailManager,
  pecEmailSenderData,
  readModelService,
  templateService
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
