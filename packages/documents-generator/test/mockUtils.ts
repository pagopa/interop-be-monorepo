/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { randomArrayItem } from "pagopa-interop-commons-test";
import {
  AgreementId,
  AgreementDocumentId,
  generateId,
  AgreementDocument,
  TenantId,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import { formatDateyyyyMMddHHmmss } from "pagopa-interop-commons";
import { config } from "../src/config/config.js";

export function getMockConsumerAgreementDocument(
  agreementId: AgreementId,
  name: string = "mockDocument"
): AgreementDocument {
  const id = generateId<AgreementDocumentId>();
  return {
    id,
    name,
    path: `${config.agreementContractsPath}/${agreementId}/${id}/${name}`,
    prettyName: "pretty name",
    contentType: "application/pdf",
    createdAt: new Date(),
  };
}

export function getMockAgreementDocumentSeed(
  document: AgreementDocument
): agreementApi.DocumentSeed {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    contentType: document.contentType,
    path: document.path,
  };
}

export function getMockAgreementContract(
  agreementId: AgreementId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementDocument {
  const id = generateId<AgreementDocumentId>();
  const createdAt = new Date();
  const contractDocumentName = `${consumerId}_${producerId}_${formatDateyyyyMMddHHmmss(
    createdAt
  )}_agreement_contract.pdf`;
  return {
    id,
    contentType: "application/pdf",
    createdAt,
    path: `${config.agreementContractsPath}/${agreementId}/${id}/${contractDocumentName}`,
    prettyName: "Richiesta di fruizione",
    name: contractDocumentName,
  };
}

export function getMockApiTenantCertifiedAttribute(): agreementApi.TenantAttribute {
  return {
    certified: {
      id: generateId(),
      assignmentTimestamp: new Date().toISOString(),
      revocationTimestamp: randomArrayItem([
        new Date().toISOString(),
        undefined,
      ]),
    },
  };
}
