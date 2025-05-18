import {
  generateId,
  unsafeBrandId,
  AgreementId,
  AgreementDocumentId,
  Agreement,
} from "pagopa-interop-models";
import { splitAgreementIntoObjectsSQL } from "pagopa-interop-readmodel";
import { AgreementItemsSQL } from "pagopa-interop-readmodel-models";
import { DBContext } from "../src/db/db.js";

export async function getAgreementFromDb(id: string, db: DBContext) {
  return db.conn.one(`SELECT * FROM domains.agreement WHERE id = $1`, [id]);
}
export async function getAgreementStampFromDb(agrId: string, db: DBContext) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_stamp WHERE agreement_id = $1`,
    [agrId]
  );
}
export async function getAgreementAttributeFromDb(
  attrId: string,
  db: DBContext
) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_attribute WHERE attribute_id = $1`,
    [attrId]
  );
}
export async function getAgreementConsumerDocumentFromDb(
  docId: string,
  db: DBContext
) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_consumer_document WHERE id = $1`,
    [docId]
  );
}
export async function getAgreementContractFromDb(
  contractId: string,
  db: DBContext
) {
  return db.conn.any(`SELECT * FROM domains.agreement_contract WHERE id = $1`, [
    contractId,
  ]);
}

export const agreementId = generateId();
export const docId = generateId();
export const contractId = generateId();

export const agreementSQL = {
  id: unsafeBrandId<AgreementId>(agreementId),
  metadataVersion: 1,
  eserviceId: generateId(),
  descriptorId: generateId(),
  producerId: generateId(),
  consumerId: generateId(),
  state: "ACTIVE",
  suspendedByConsumer: null,
  suspendedByProducer: null,
  suspendedByPlatform: null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
  consumerNotes: null,
  rejectionReason: null,
  suspendedAt: null,
};

export const stampSQL = {
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  who: generateId(),
  delegationId: null,
  when: new Date().toISOString(),
  kind: "Producer",
};

export const attributeSQL = {
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  attributeId: generateId(),
  kind: "verified",
};

export const consumerDocSQL = {
  id: unsafeBrandId<AgreementDocumentId>(docId),
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  name: "sampledoc.pdf",
  prettyName: "sampledoc.pdf",
  contentType: "application/pdf",
  path: "/docs/sample.pdf",
  createdAt: new Date().toISOString(),
};

export const contractDocSQL = {
  id: unsafeBrandId<AgreementDocumentId>(contractId),
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  name: "contract.pdf",
  prettyName: "contract.pdf",
  contentType: "application/pdf",
  path: "/docs/contract.pdf",
  createdAt: new Date().toISOString(),
};

export const agreementItem: AgreementItemsSQL = {
  agreementSQL,
  stampsSQL: [stampSQL],
  attributesSQL: [attributeSQL],
  consumerDocumentsSQL: [consumerDocSQL],
  contractSQL: contractDocSQL,
};

export function getMockAgreement(
  overrides: Partial<Agreement> = {}
): Agreement & { metadataVersion: number } {
  const agreementId = unsafeBrandId<AgreementId>(generateId());
  const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
  return {
    id: agreementId,
    metadataVersion: 1,
    eserviceId: generateId(),
    descriptorId: generateId(),
    producerId: generateId(),
    consumerId: generateId(),
    state: "Active",
    suspendedByConsumer: false,
    suspendedByProducer: false,
    suspendedByPlatform: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    consumerNotes: "consumer notes",
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    contract: {
      id: unsafeBrandId<AgreementDocumentId>(contractId),
      name: "contract.pdf",
      prettyName: "contract.pdf",
      contentType: "application/pdf",
      path: "/docs/contract.pdf",
      createdAt: new Date(),
    },
    stamps: {},
    ...overrides,
  };
}

export function agreementItemFromDomain(
  agr: Agreement & { metadataVersion: number }
): AgreementItemsSQL {
  return splitAgreementIntoObjectsSQL(agr, agr.metadataVersion);
}
