import {
  AgreementDocument,
  AgreementDocumentId,
  AgreementId,
  generateId,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";

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
