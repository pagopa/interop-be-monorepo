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
import { IDatabase } from "pg-promise";
import {
  ReadEvent,
  StoredEvent,
  readEventByStreamIdAndVersion,
  readLastEventByStreamId,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  AgreementCollection,
  EServiceCollection,
  FileManager,
  TenantCollection,
  genericLogger,
} from "pagopa-interop-commons";
import { expect } from "vitest";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import { config } from "../src/utilities/config.js";

export const writeAgreementInEventstore = async (
  agreement: Agreement,
  postgresDB: IDatabase<unknown>
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

export const addOneAgreement = async (
  agreement: Agreement,
  postgresDB: IDatabase<unknown>,
  agreements: AgreementCollection
): Promise<void> => {
  await writeAgreementInEventstore(agreement, postgresDB);
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const addOneEService = async (
  eservice: EService,
  eservices: EServiceCollection
): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneTenant = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await writeInReadmodel(tenant, tenants);
};

export const readLastAgreementEvent = async (
  agreementId: AgreementId,
  postgresDB: IDatabase<unknown>
): Promise<ReadEvent<AgreementEvent>> =>
  await readLastEventByStreamId(agreementId, "agreement", postgresDB);

export const readAgreementEventByVersion = async (
  agreementId: AgreementId,
  version: number,
  postgresDB: IDatabase<unknown>
): Promise<ReadEvent<AgreementEvent>> =>
  await readEventByStreamIdAndVersion(
    agreementId,
    version,
    "agreement",
    postgresDB
  );

export async function uploadDocument(
  agreementId: AgreementId,
  documentId: AgreementDocumentId,
  name: string,
  fileManager: FileManager
): Promise<void> {
  const documentDestinationPath = `${config.consumerDocumentsPath}/${agreementId}`;
  await fileManager.storeBytes(
    config.s3Bucket,
    documentDestinationPath,
    documentId,
    name,
    Buffer.from("large-document-file"),
    genericLogger
  );
  expect(
    await fileManager.listFiles(config.s3Bucket, genericLogger)
  ).toContainEqual(
    `${config.consumerDocumentsPath}/${agreementId}/${documentId}/${name}`
  );
}

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
