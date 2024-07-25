import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  Agreement,
  EService,
  Tenant,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelTenant,
} from "pagopa-interop-models";
import axios, { AxiosResponse } from "axios";
import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const readModelConfig = inject("readModelConfig");
export const emailManagerConfig = inject("emailManagerConfig");

export const { cleanup, readModelRepository, emailManager } =
  setupTestContainersVitest(
    readModelConfig,
    undefined,
    undefined,
    emailManagerConfig
  );
export const readModelService = readModelServiceBuilder(readModelRepository);
export const templateService = buildHTMLTemplateService();

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
