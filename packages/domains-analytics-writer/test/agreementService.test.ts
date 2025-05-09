/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach } from "vitest";
import {
  AgreementAddedV1,
  AgreementDeletedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementContractAddedV1,
  AgreementEventEnvelopeV1,
  AgreementAddedV2,
  AgreementDeletedV2,
  AgreementConsumerDocumentRemovedV2,
  AgreementEventEnvelopeV2,
  generateId,
  unsafeBrandId,
  AgreementDocumentId,
  toAgreementV2,
} from "pagopa-interop-models";
import {
  getMockAgreement,
  getMockAgreementDocument,
  toAgreementV1,
  toAgreementDocumentV1,
} from "pagopa-interop-commons-test";
import { handleAgreementMessageV1 } from "../src/handlers/agreement/consumerServiceV1.js";
import { handleAgreementMessageV2 } from "../src/handlers/agreement/consumerServiceV2.js";
import {
  dbContext,
  resetAgreementTables,
  getAgreementFromDb,
  getAgreementAttributeFromDb,
  getAgreementConsumerDocumentFromDb,
  getAgreementContractFromDb,
  getAgreementStampFromDb,
} from "./utils.js";

describe("Agreement messages consumers - handleAgreementMessageV1", () => {
  beforeEach(async () => {
    await resetAgreementTables(dbContext);
  });

  it("AgreementAdded: inserts agreement with stamps, attributes, consumer docs and contract", async () => {
    const mock = getMockAgreement();
    const doc = getMockAgreementDocument();
    mock.consumerDocuments = [doc];
    const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
    const contractDoc = { ...getMockAgreementDocument(), id: contractId };
    mock.contract = contractDoc;

    const msg: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 1,
      type: "AgreementAdded",
      data: { agreement: toAgreementV1(mock) } as AgreementAddedV1,
      log_date: new Date(),
    };

    await handleAgreementMessageV1([msg], dbContext);

    const storedAgreement = await getAgreementFromDb(mock.id, dbContext);
    expect(storedAgreement).toBeDefined();
    expect(storedAgreement.metadata_version).toBe(1);

    const storedStamps = await getAgreementStampFromDb(mock.id, dbContext);
    expect(storedStamps.length).toBeGreaterThan(0);

    const attrId = mock.certifiedAttributes[0].id;
    const attrs = await getAgreementAttributeFromDb(attrId, dbContext);
    expect(attrs.length).toBeGreaterThan(0);

    const storedDocs = await getAgreementConsumerDocumentFromDb(
      doc.id,
      dbContext
    );
    expect(storedDocs.length).toBeGreaterThan(0);
    expect(storedDocs[0].metadata_version).toBe(1);

    const storedContract = await getAgreementContractFromDb(
      contractId,
      dbContext
    );
    expect(storedContract.length).toBeGreaterThan(0);
    expect(storedContract[0].metadata_version).toBe(1);
  });

  it("AgreementConsumerDocumentAdded: inserts new document", async () => {
    const mock = getMockAgreement();
    const doc = getMockAgreementDocument();

    const addMsg: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 1,
      type: "AgreementAdded",
      data: { agreement: toAgreementV1(mock) } as AgreementAddedV1,
      log_date: new Date(),
    };
    const docMsg: AgreementEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      event_version: 1,
      type: "AgreementConsumerDocumentAdded",
      data: {
        agreementId: mock.id,
        document: toAgreementDocumentV1(doc),
      } as AgreementConsumerDocumentAddedV1,
      log_date: new Date(),
    };

    await handleAgreementMessageV1([addMsg, docMsg], dbContext);

    const stored = await getAgreementConsumerDocumentFromDb(doc.id, dbContext);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0].metadata_version).toBe(2);
  });

  it("AgreementUpdated: applies update", async () => {
    const mock = getMockAgreement();
    const addMsg: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 1,
      type: "AgreementAdded",
      data: { agreement: toAgreementV1(mock) } as AgreementAddedV1,
      log_date: new Date(),
    };

    const updated = { ...mock, state: "Suspended" };

    const updatedMsg: AgreementEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      event_version: 1,
      type: "AgreementUpdated",
      data: { agreement: toAgreementV1(updated as any) } as any,
      log_date: new Date(),
    };

    await handleAgreementMessageV1([addMsg, updatedMsg], dbContext);

    const stored = await getAgreementFromDb(mock.id, dbContext);
    expect(stored.metadata_version).toBe(2);
    expect(stored.state).toBe("Suspended");
  });

  it("AgreementDeleted: marks agreement and all subobjects deleted", async () => {
    const doc = getMockAgreementDocument();
    const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
    const contractDoc = { ...getMockAgreementDocument(), id: contractId };
    const mock = { ...getMockAgreement() };
    mock.consumerDocuments = [doc];
    mock.contract = contractDoc;

    const addMsg: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 1,
      type: "AgreementAdded",
      data: { agreement: toAgreementV1(mock) } as AgreementAddedV1,
      log_date: new Date(),
    };
    const delMsg: AgreementEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      event_version: 1,
      type: "AgreementDeleted",
      data: { agreementId: mock.id } as AgreementDeletedV1,
      log_date: new Date(),
    };

    await handleAgreementMessageV1([addMsg, delMsg], dbContext);

    const storedAgreement = await getAgreementFromDb(mock.id, dbContext);
    expect(storedAgreement.deleted).toBe(true);

    const storedStamps = await getAgreementStampFromDb(mock.id, dbContext);
    storedStamps.forEach((s) => expect(s.deleted).toBe(true));

    const attrId = mock.certifiedAttributes[0].id;
    const attrs = await getAgreementAttributeFromDb(attrId, dbContext);
    attrs.forEach((a) => expect(a.deleted).toBe(true));

    const docs = await getAgreementConsumerDocumentFromDb(doc.id, dbContext);
    docs.forEach((d) => expect(d.deleted).toBe(true));
    const ct = await getAgreementContractFromDb(contractId, dbContext);
    ct.forEach((c) => expect(c.deleted).toBe(true));
  });

  it("AgreementContractAdded: overwrites contract if metadata_version is higher", async () => {
    const mock = getMockAgreement();
    const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
    const original = {
      ...getMockAgreementDocument(),
      id: contractId,
      prettyName: "orig.pdf",
    };
    mock.contract = original;

    const addMsg: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 1,
      type: "AgreementAdded",
      data: { agreement: toAgreementV1(mock) } as AgreementAddedV1,
      log_date: new Date(),
    };

    const updated = { ...original, prettyName: "updated.pdf" };
    const updateMsg: AgreementEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      event_version: 1,
      type: "AgreementContractAdded",
      data: {
        agreementId: mock.id,
        contract: toAgreementDocumentV1(updated),
      } as AgreementContractAddedV1,
      log_date: new Date(),
    };

    await handleAgreementMessageV1([addMsg, updateMsg], dbContext);

    const stored = await getAgreementContractFromDb(contractId, dbContext);
    expect(stored.length).toBe(1);
    expect(stored[0].pretty_name).toBe("updated.pdf");
    expect(stored[0].metadata_version).toBe(2);
  });
});

describe("Agreement messages consumers - handleAgreementMessageV2", () => {
  beforeEach(async () => {
    await resetAgreementTables(dbContext);
  });

  it("AgreementAdded: inserts agreement with stamps, attributes, consumer docs and contract (V2)", async () => {
    const mock = getMockAgreement();
    const doc = getMockAgreementDocument();
    mock.consumerDocuments = [doc];
    const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
    const contractDoc = { ...getMockAgreementDocument(), id: contractId };
    mock.contract = contractDoc;

    const msg: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 2,
      type: "AgreementAdded",
      data: { agreement: toAgreementV2(mock) } as AgreementAddedV2,
      log_date: new Date(),
    };

    await handleAgreementMessageV2([msg], dbContext);

    const storedAgreement = await getAgreementFromDb(mock.id, dbContext);
    expect(storedAgreement).toBeDefined();
    expect(storedAgreement.metadata_version).toBe(1);

    const storedStamps = await getAgreementStampFromDb(mock.id, dbContext);
    expect(storedStamps.length).toBeGreaterThan(0);

    const attrId = mock.certifiedAttributes[0].id;
    const attrs = await getAgreementAttributeFromDb(attrId, dbContext);
    expect(attrs.length).toBeGreaterThan(0);

    const storedDocs = await getAgreementConsumerDocumentFromDb(
      doc.id,
      dbContext
    );
    expect(storedDocs.length).toBeGreaterThan(0);
    expect(storedDocs[0].metadata_version).toBe(1);

    const storedContract = await getAgreementContractFromDb(
      contractId,
      dbContext
    );
    expect(storedContract.length).toBeGreaterThan(0);
    expect(storedContract[0].metadata_version).toBe(1);
  });

  it("AgreementConsumerDocumentRemoved: marks consumer document as deleted ", async () => {
    const doc = getMockAgreementDocument();
    const mock = { ...getMockAgreement(), consumerDocuments: [doc] };

    const addMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 2,
      type: "AgreementAdded",
      data: { agreement: toAgreementV2(mock) } as AgreementAddedV2,
      log_date: new Date(),
    };
    const remMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      event_version: 2,
      type: "AgreementConsumerDocumentRemoved",
      data: {
        agreement: toAgreementV2(mock),
        documentId: doc.id,
      } as AgreementConsumerDocumentRemovedV2,
      log_date: new Date(),
    };

    await handleAgreementMessageV2([addMsg, remMsg], dbContext);

    const stored = await getAgreementConsumerDocumentFromDb(doc.id, dbContext);
    expect(stored.length).toBe(1);
    expect(stored[0].deleted).toBe(true);
  });

  it("AgreementSuspendedByProducer: applies update", async () => {
    const mock = getMockAgreement();
    const addMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 2,
      type: "AgreementAdded",
      data: { agreement: toAgreementV2(mock) } as AgreementAddedV2,
      log_date: new Date(),
    };

    const upgraded = { ...mock, state: "Suspended" };

    const upgradeMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      event_version: 2,
      type: "AgreementSuspendedByProducer",
      data: { agreement: toAgreementV2(upgraded as any) } as any,
      log_date: new Date(),
    };

    await handleAgreementMessageV2([addMsg, upgradeMsg], dbContext);

    const stored = await getAgreementFromDb(mock.id, dbContext);
    expect(stored.metadata_version).toBe(2);
    expect(stored.state).toBe("Suspended");
  });

  it("AgreementDeleted: marks agreement and all subobjects deleted (V2)", async () => {
    const doc = getMockAgreementDocument();
    const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
    const contractDoc = { ...getMockAgreementDocument(), id: contractId };
    const mock = { ...getMockAgreement() };
    mock.consumerDocuments = [doc];
    mock.contract = contractDoc;

    const addMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 2,
      type: "AgreementAdded",
      data: { agreement: toAgreementV2(mock) } as AgreementAddedV2,
      log_date: new Date(),
    };
    const delMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      event_version: 2,
      type: "AgreementDeleted",
      data: { agreement: toAgreementV2(mock) } as AgreementDeletedV2,
      log_date: new Date(),
    };

    await handleAgreementMessageV2([addMsg, delMsg], dbContext);

    const storedAgreement = await getAgreementFromDb(mock.id, dbContext);
    expect(storedAgreement.deleted).toBe(true);

    const storedStamps = await getAgreementStampFromDb(mock.id, dbContext);
    storedStamps.forEach((s) => expect(s.deleted).toBe(true));

    const attrId = mock.certifiedAttributes[0].id;
    const attrs = await getAgreementAttributeFromDb(attrId, dbContext);
    attrs.forEach((a) => expect(a.deleted).toBe(true));

    const docs = await getAgreementConsumerDocumentFromDb(doc.id, dbContext);
    docs.forEach((d) => expect(d.deleted).toBe(true));

    const ct = await getAgreementContractFromDb(contractId, dbContext);
    ct.forEach((c) => expect(c.deleted).toBe(true));
  });
});
