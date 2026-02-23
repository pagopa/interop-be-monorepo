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
import { AgreementDbTable } from "../src/model/db/index.js";
import {
  dbContext,
  resetTargetTables,
  getManyFromDb,
  getOneFromDb,
  agreementTables,
} from "./utils.js";

describe("Agreement messages consumers - handleAgreementMessageV1", () => {
  beforeEach(async () => {
    await resetTargetTables(agreementTables);
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

    const storedAgreement = await getOneFromDb(
      dbContext,
      AgreementDbTable.agreement,
      { id: mock.id }
    );
    expect(storedAgreement).toBeDefined();
    expect(storedAgreement?.metadataVersion).toBe(1);

    const storedStamps = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_stamp,
      { agreementId: mock.id }
    );
    expect(storedStamps.length).toBeGreaterThan(0);

    const attrId = mock.certifiedAttributes[0].id;
    const attrs = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_attribute,
      { attributeId: attrId }
    );
    expect(attrs.length).toBeGreaterThan(0);

    const storedDocs = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_consumer_document,
      { id: doc.id }
    );
    expect(storedDocs.length).toBeGreaterThan(0);
    expect(storedDocs[0].metadataVersion).toBe(1);

    const storedContract = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_contract,
      { id: contractId }
    );
    expect(storedContract.length).toBeGreaterThan(0);
    expect(storedContract[0].metadataVersion).toBe(1);
  });

  it("AgreementAdded: processes duplicate events should not throw MERGE error", async () => {
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

    const duplicateEventMsg = msg;

    await expect(
      handleAgreementMessageV1([msg, duplicateEventMsg], dbContext)
    ).resolves.not.toThrowError();
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

    const stored = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_consumer_document,
      { id: doc.id }
    );
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0].metadataVersion).toBe(2);
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

    const stored = await getOneFromDb(dbContext, AgreementDbTable.agreement, {
      id: mock.id,
    });
    expect(stored?.metadataVersion).toBe(2);
    expect(stored?.state).toBe("Suspended");
  });

  it("AgreementDeleted: marks agreement and all subobjects deleted", async () => {
    const doc = getMockAgreementDocument();
    const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
    const contractDoc = { ...getMockAgreementDocument(), id: contractId };
    const mock = {
      ...getMockAgreement(),
      consumerDocuments: [doc],
      contract: contractDoc,
    };

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

    const storedAgreement = await getOneFromDb(
      dbContext,
      AgreementDbTable.agreement,
      { id: mock.id }
    );
    expect(storedAgreement?.deleted).toBe(true);

    const storedStamps = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_stamp,
      { agreementId: mock.id }
    );
    storedStamps.forEach((s) => expect(s.deleted).toBe(true));

    const attrId = mock.certifiedAttributes[0].id;
    const attrs = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_attribute,
      { attributeId: attrId }
    );
    attrs.forEach((a) => expect(a.deleted).toBe(true));

    const docs = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_consumer_document,
      { id: doc.id }
    );
    docs.forEach((d) => expect(d.deleted).toBe(true));

    const ct = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_contract,
      { id: contractId }
    );
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

    const stored = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_contract,
      { id: contractId }
    );
    expect(stored.length).toBe(1);
    expect(stored[0].prettyName).toBe("updated.pdf");
    expect(stored[0].metadataVersion).toBe(2);
  });
});

describe("Agreement messages consumers - handleAgreementMessageV2", () => {
  beforeEach(async () => {
    await resetTargetTables(agreementTables);
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

    const storedAgreement = await getOneFromDb(
      dbContext,
      AgreementDbTable.agreement,
      { id: mock.id }
    );
    expect(storedAgreement).toBeDefined();
    expect(storedAgreement?.metadataVersion).toBe(1);

    const storedStamps = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_stamp,
      { agreementId: mock.id }
    );
    expect(storedStamps.length).toBeGreaterThan(0);

    const attrId = mock.certifiedAttributes[0].id;
    const attrs = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_attribute,
      { attributeId: attrId }
    );
    expect(attrs.length).toBeGreaterThan(0);

    const storedDocs = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_consumer_document,
      { id: doc.id }
    );
    expect(storedDocs.length).toBeGreaterThan(0);
    expect(storedDocs[0].metadataVersion).toBe(1);

    const storedContract = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_contract,
      { id: contractId }
    );
    expect(storedContract.length).toBeGreaterThan(0);
    expect(storedContract[0].metadataVersion).toBe(1);
  });

  it("AgreementConsumerDocumentRemoved: should delete consumer document", async () => {
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
        agreement: toAgreementV2({ ...mock, consumerDocuments: [] }),
        documentId: doc.id,
      } as AgreementConsumerDocumentRemovedV2,
      log_date: new Date(),
    };

    await handleAgreementMessageV2([addMsg, remMsg], dbContext);

    const stored = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_consumer_document,
      { id: doc.id }
    );
    expect(stored.length).toBe(0);
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

    const stored = await getOneFromDb(dbContext, AgreementDbTable.agreement, {
      id: mock.id,
    });
    expect(stored?.metadataVersion).toBe(2);
    expect(stored?.state).toBe("Suspended");
  });

  it("AgreementDeleted: marks agreement and all subobjects deleted (V2)", async () => {
    const doc = getMockAgreementDocument();
    const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
    const contractDoc = { ...getMockAgreementDocument(), id: contractId };
    const mock = {
      ...getMockAgreement(),
      consumerDocuments: [doc],
      contract: contractDoc,
    };

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

    const storedAgreement = await getOneFromDb(
      dbContext,
      AgreementDbTable.agreement,
      { id: mock.id }
    );
    expect(storedAgreement?.deleted).toBe(true);

    const storedStamps = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_stamp,
      { agreementId: mock.id }
    );
    storedStamps.forEach((s) => expect(s.deleted).toBe(true));

    const attrId = mock.certifiedAttributes[0].id;
    const attrs = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_attribute,
      { attributeId: attrId }
    );
    attrs.forEach((a) => expect(a.deleted).toBe(true));

    const docs = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_consumer_document,
      { id: doc.id }
    );
    docs.forEach((d) => expect(d.deleted).toBe(true));

    const ct = await getManyFromDb(
      dbContext,
      AgreementDbTable.agreement_contract,
      { id: contractId }
    );
    ct.forEach((c) => expect(c.deleted).toBe(true));
  });
});
