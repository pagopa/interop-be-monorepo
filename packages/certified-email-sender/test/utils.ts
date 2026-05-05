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

const emailManagerConfig = inject("emailManagerConfig");

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

afterEach(cleanup);
