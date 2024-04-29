import {
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
  ReadEvent,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementEvent,
  AgreementId,
  EService,
  Tenant,
  generateId,
  toReadModelEService,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { agreementQueryBuilder } from "../src/services/readmodel/agreementQuery.js";
import { attributeQueryBuilder } from "../src/services/readmodel/attributeQuery.js";
import { eserviceQueryBuilder } from "../src/services/readmodel/eserviceQuery.js";
import { readModelServiceBuilder } from "../src/services/readmodel/readModelService.js";
import { tenantQueryBuilder } from "../src/services/readmodel/tenantQuery.js";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import { config } from "../src/utilities/config.js";

export const { readModelRepository, postgresDB, fileManager, cleanup } =
  setupTestContainersVitest(inject("config"));

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;

export const readModelService = readModelServiceBuilder(readModelRepository);

const eserviceQuery = eserviceQueryBuilder(readModelService);
const agreementQuery = agreementQueryBuilder(readModelService);
const tenantQuery = tenantQueryBuilder(readModelService);
const attributeQuery = attributeQueryBuilder(readModelService);

export const agreementService = agreementServiceBuilder(
  postgresDB,
  agreementQuery,
  tenantQuery,
  eserviceQuery,
  attributeQuery,
  fileManager
);
export const writeAgreementInEventstore = async (
  agreement: Agreement
): Promise<void> => {
  const agreementEvent: AgreementEvent = {
    type: "AgreementAdded",
    event_version: 1,
    data: { agreement: toAgreementV1(agreement) },
  };
  const eventToWrite: StoredEvent<AgreementEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: agreementEvent.data.agreement!.id,
    version: 0,
    event: agreementEvent,
  };

  await writeInEventstore(eventToWrite, "agreement", postgresDB);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeAgreementInEventstore(agreement);
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(tenant, tenants);
};

export const readLastAgreementEvent = async (
  agreementId: AgreementId
): Promise<ReadEvent<AgreementEvent>> =>
  await readLastEventByStreamId(agreementId, "agreement", postgresDB);

export function getMockConsumerDocument(
  agreementId: AgreementId,
  name: string = "mockDocument"
): AgreementDocument {
  const id = generateId<AgreementDocumentId>();
  return {
    id,
    name,
    path: `${config.consumerDocumentsPath}/${agreementId}/${id}/${name}`,
    prettyName: "pretty name",
    contentType: "application/pdf",
    createdAt: new Date(),
  };
}
