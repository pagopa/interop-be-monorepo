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

const emailManagerConfig = inject("emailManagerConfig");
export const sesEmailManagerConfig = inject("sesEmailManagerConfig");

const {
  cleanup,
  sesEmailManager: _sesEmailManager,
  readModelDB,
} = await setupTestContainersVitest(
  undefined,
  undefined,
  emailManagerConfig,
  undefined,
  sesEmailManagerConfig,
  inject("readModelSQLConfig")
);

export const sesEmailManager = _sesEmailManager;

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

export const templateService = buildHTMLTemplateService();

const sesEmailManagerFailure: EmailManagerSES = {
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

afterEach(cleanup);
