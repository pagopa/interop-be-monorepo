import {
  agreementApi,
  catalogApi,
  eserviceTemplateApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";

type Document =
  | catalogApi.EServiceDoc
  | eserviceTemplateApi.EServiceDoc
  | agreementApi.Document;

function isAgreementDocument(doc: Document): doc is agreementApi.Document {
  return "createdAt" in doc;
}

export function toM2MGatewayApiDocument(
  document: Document
): m2mGatewayApi.Document {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    createdAt: isAgreementDocument(document)
      ? document.createdAt
      : document.uploadDate,
    contentType: document.contentType,
  };
}
