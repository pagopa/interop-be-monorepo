import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject, vi } from "vitest";
import {
  Agreement,
  EService,
  Tenant,
  toReadModelAgreement,
  toReadModelEService,
} from "pagopa-interop-models";
import {
  InstitutionResponse,
  SelfcareV2Client,
} from "pagopa-interop-selfcare-v2-client";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { agreementEmailSenderConfig } from "../src/utilities/config.js";

export const readModelConfig = inject("readModelConfig");
export const emailManagerConfig = inject("emailManagerConfig");

export const config = agreementEmailSenderConfig();

const mockSelfcareInstitution: InstitutionResponse = {
  digitalAddress: "test@test.com",
};

export const selfcareV2ClientMock: SelfcareV2Client = {} as SelfcareV2Client;
// eslint-disable-next-line functional/immutable-data
selfcareV2ClientMock.getInstitution = vi.fn(
  async () => mockSelfcareInstitution
);

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
