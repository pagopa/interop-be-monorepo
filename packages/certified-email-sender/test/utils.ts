import axios, { AxiosResponse } from "axios";
import { buildHTMLTemplateService } from "pagopa-interop-commons";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  EService,
  Tenant,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { certifiedEmailSenderServiceBuilder } from "../src/services/certifiedEmailSenderService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { config } from "../src/config/config.js";

export const emailManagerConfig = inject("emailManagerConfig");

export const { cleanup, readModelRepository, pecEmailManager, readModelDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    undefined,
    undefined,
    emailManagerConfig,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});
const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

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
