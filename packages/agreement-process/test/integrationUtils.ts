/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  ReadEvent,
  readEventByStreamIdAndVersion,
  sortAgreements,
  sortBy,
} from "pagopa-interop-commons-test";
import { afterAll, afterEach, expect, inject, vi } from "vitest";
import {
  Agreement,
  AgreementEvent,
  AgreementId,
  EService,
  Tenant,
  toAgreementV2,
  AgreementDocumentId,
  Attribute,
  Delegation,
  ListResult,
  AgreementV2,
  CertifiedAttributeV2,
  DeclaredAttributeV2,
  VerifiedAttributeV2,
} from "pagopa-interop-models";
import {
  genericLogger,
  initPDFGenerator,
  launchPuppeteerBrowser,
} from "pagopa-interop-commons";
import puppeteer, { Browser } from "puppeteer";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertAttribute,
  upsertDelegation,
  upsertEService,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { config } from "../src/config/config.js";
import { contractBuilder } from "../src/services/agreementContractBuilder.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, postgresDB, fileManager, readModelDB } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    inject("fileManagerConfig"),
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const readModelService = readModelServiceBuilderSQL(
  readModelDB,
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL,
  delegationReadModelServiceSQL
);

export const pdfGenerator = await initPDFGenerator();

export const agreementContractBuilder = contractBuilder(
  readModelService,
  pdfGenerator,
  fileManager,
  config,
  genericLogger
);

export const agreementService = agreementServiceBuilder(
  postgresDB,
  readModelService,
  fileManager,
  pdfGenerator
);
export const writeAgreementInEventstore = async (
  agreement: Agreement
): Promise<void> => {
  const agreementEvent: AgreementEvent = {
    type: "AgreementAdded",
    event_version: 2,
    data: { agreement: toAgreementV2(agreement) },
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
  await upsertAgreement(readModelDB, agreement, 0);
};
export const writeOnlyOneAgreement = async (
  agreement: Agreement
): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};
export const updateOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 1);
};

export const updateOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 1);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await upsertDelegation(readModelDB, delegation, 0);
};

export const readLastAgreementEvent = async (
  agreementId: AgreementId
): Promise<ReadEvent<AgreementEvent>> =>
  await readLastEventByStreamId(agreementId, "agreement", postgresDB);

export const readAgreementEventByVersion = async (
  agreementId: AgreementId,
  version: number
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
  name: string
): Promise<void> {
  const documentDestinationPath = `${config.consumerDocumentsPath}/${agreementId}`;
  await fileManager.storeBytes(
    {
      bucket: config.s3Bucket,
      path: documentDestinationPath,
      resourceId: documentId,
      name,
      content: Buffer.from("large-document-file"),
    },
    genericLogger
  );
  expect(
    await fileManager.listFiles(config.s3Bucket, genericLogger)
  ).toContainEqual(
    `${config.consumerDocumentsPath}/${agreementId}/${documentId}/${name}`
  );
}

export async function addDelegationsAndDelegates({
  producerDelegation,
  delegateProducer,
  consumerDelegation,
  delegateConsumer,
}: {
  producerDelegation: Delegation | undefined;
  delegateProducer: Tenant | undefined;
  consumerDelegation: Delegation | undefined;
  delegateConsumer: Tenant | undefined;
}): Promise<void> {
  if (producerDelegation && delegateProducer) {
    await addOneDelegation(producerDelegation);
    await addOneTenant(delegateProducer);
  }

  if (consumerDelegation && delegateConsumer) {
    await addOneDelegation(consumerDelegation);
    await addOneTenant(delegateConsumer);
  }
}

export function expectSinglePageListResult(
  actual: ListResult<Agreement>,
  expected: Agreement[]
): void {
  expect({
    totalCount: actual.totalCount,
    results: sortAgreements(actual.results),
  }).toEqual({
    totalCount: expected.length,
    results: expect.arrayContaining(sortAgreements(expected)),
  });
  expect(actual.results).toHaveLength(expected.length);
}

export function expectGenericSinglePageListResult<T>(
  actual: ListResult<T>,
  expected: T[]
): void {
  expect(actual).toEqual({
    totalCount: expected.length,
    results: expect.arrayContaining(expected),
  });
  expect(actual.results).toHaveLength(expected.length);
}

export const sortListAgreements = (agreements: Agreement[]): Agreement[] =>
  sortAgreements([...agreements].sort(sortBy<Agreement>((a) => a.id)));

export const sortAgreementAttributes = <T extends AgreementV2 | undefined>(
  agreement: T
): T => {
  if (!agreement) {
    return agreement;
  }
  return {
    ...agreement,
    verifiedAttributes: agreement.verifiedAttributes
      ? [...agreement.verifiedAttributes].sort(
          sortBy<VerifiedAttributeV2>((attr) => attr.id)
        )
      : [],
    certifiedAttributes: agreement.certifiedAttributes
      ? [...agreement.certifiedAttributes].sort(
          sortBy<CertifiedAttributeV2>((att) => att.id)
        )
      : [],
    declaredAttributes: agreement.declaredAttributes
      ? [...agreement.declaredAttributes].sort(
          sortBy<DeclaredAttributeV2>((att) => att.id)
        )
      : [],
  };
};

export async function updateAgreementInReadModel(
  agreement: Agreement
): Promise<void> {
  await updateOneAgreementRelationalDB(agreement);
}

const updateOneAgreementRelationalDB = async (
  agreement: Agreement
): Promise<void> => {
  const agreementRetrieved =
    await agreementReadModelServiceSQL.getAgreementById(agreement.id);
  const currentVersion = agreementRetrieved?.metadata.version;

  if (currentVersion === undefined) {
    throw new Error("Agreement not found in read model. Cannot update.");
  }

  await upsertAgreement(readModelDB, agreement, currentVersion + 1);
};
