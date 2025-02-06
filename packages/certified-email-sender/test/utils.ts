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
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { certifiedEmailSenderServiceBuilder } from "../src/services/certifiedEmailSenderService.js";

export const readModelConfig = inject("readModelConfig");
export const emailManagerConfig = inject("emailManagerConfig");

export const { cleanup, readModelRepository, pecEmailManager } =
  await setupTestContainersVitest(
    readModelConfig,
    undefined,
    undefined,
    emailManagerConfig,
    undefined,
    undefined
  );
export const readModelService = readModelServiceBuilder(readModelRepository);
export const templateService = buildHTMLTemplateService();

export const pecEmailsenderData = {
  label: "pec_sender",
  mail: "pec_sender@test.com",
};
export const interopFeBaseUrl = "http://localhost/fe";

export const certifiedEmailSenderService = certifiedEmailSenderServiceBuilder(
  pecEmailManager,
  pecEmailsenderData,
  readModelService,
  templateService
);

export const certifiedEmailSenderServiceFailure =
  certifiedEmailSenderServiceBuilder(
    pecEmailManager,
    pecEmailsenderData,
    readModelService,
    templateService
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
