import { AuthData, CreateEvent } from "pagopa-interop-commons";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { AgreementEvent } from "pagopa-interop-models";
import { agreementDocumentAlreadyExists, agreementDocumentNotFound } from "../model/domain/errors.js";
import { toCreateEventAgreementConsumerDocumentAdded, toCreateEventAgreementConsumerDocumentRemoved } from "../model/domain/toEvent.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  assertAgreementExist,
  assertCanWorkOnConsumerDocuments,
  assertRequesterIsConsumer,
} from "../model/domain/validators.js";
import { config } from "../utilities/config.js";

export async function addConsumerDocumentLogic(
  agreementId: string,
  payload: ApiAgreementDocumentSeed,
  agreementQuery: AgreementQuery,
  authData: AuthData
): Promise<CreateEvent<AgreementEvent>> {
  const agreement = await agreementQuery.getAgreementById(agreementId);

  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);
  assertCanWorkOnConsumerDocuments(agreement.data.state);

  const existentDocument = agreement.data.consumerDocuments.find(
    (d) => d.id === payload.id
  );

  if (existentDocument) {
    throw agreementDocumentAlreadyExists(agreementId);
  }

  return toCreateEventAgreementConsumerDocumentAdded(
    agreementId,
    apiAgreementDocumentToAgreementDocument(payload),
    agreement.metadata.version
  );
}

export async function removeAgreementConsumerDocumentLogic(
  agreementId: string,
  documentId: string,
  agreementQuery: AgreementQuery,
  authData: AuthData,
  fileRemove: (container: string, path: string) => Promise<void>
): Promise<CreateEvent<AgreementEvent>> {
  const agreement = await agreementQuery.getAgreementById(agreementId);

  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);
  assertCanWorkOnConsumerDocuments(agreement.data.state);

  const existentDocument = agreement.data.consumerDocuments.find(
    (d) => d.id === documentId
  );

  if (!existentDocument) {
    throw agreementDocumentNotFound(documentId, agreementId);
  }

  await fileRemove(config.storageContainer, existentDocument.path);

  return toCreateEventAgreementConsumerDocumentRemoved(
    agreementId,
    documentId,
    agreement.metadata.version
  );
}
