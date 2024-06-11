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
} from "pagopa-interop-models";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { agreementEmailSenderConfig } from "../src/utilities/config.js";

export const readModelConfig = inject("readModelConfig");
export const emailManagerConfig = inject("emailManagerConfig");

export const config = agreementEmailSenderConfig();

export const { cleanup, readModelRepository, emailManager } =
  setupTestContainersVitest(
    readModelConfig,
    undefined,
    undefined,
    emailManagerConfig
  );
export const readModelService = readModelServiceBuilder(readModelRepository);

export const agreements = readModelRepository.agreements;

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(tenant, readModelRepository.tenants);
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

afterEach(cleanup);
