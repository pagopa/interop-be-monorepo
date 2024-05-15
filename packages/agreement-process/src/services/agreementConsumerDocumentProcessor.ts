/* eslint-disable max-params */
import {
  AuthData,
  CreateEvent,
  Logger,
  WithLogger,
  AppContext,
  FileManager,
} from "pagopa-interop-commons";
import {
  AgreementDocument,
  AgreementDocumentId,
  AgreementEvent,
  AgreementId,
} from "pagopa-interop-models";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import {
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementConsumerDocumentRemoved,
} from "../model/domain/toEvent.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  assertAgreementExist,
  assertCanWorkOnConsumerDocuments,
  assertRequesterIsConsumer,
} from "../model/domain/validators.js";
import { config } from "../utilities/config.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";

export async function addConsumerDocumentLogic(
  agreementId: AgreementId,
  payload: ApiAgreementDocumentSeed,
  agreementQuery: AgreementQuery,
  { authData, correlationId }: WithLogger<AppContext>
): Promise<[AgreementDocument, CreateEvent<AgreementEvent>]> {
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
  const newDocument = apiAgreementDocumentToAgreementDocument(payload);

  const updatedAgreement = {
    ...agreement.data,
    consumerDocuments: [...agreement.data.consumerDocuments, newDocument],
  };

  return [
    newDocument,
    toCreateEventAgreementConsumerDocumentAdded(
      newDocument.id,
      updatedAgreement,
      agreement.metadata.version,
      correlationId
    ),
  ];
}

// eslint-disable-next-line max-params
export async function removeAgreementConsumerDocumentLogic(
  agreementId: AgreementId,
  documentId: AgreementDocumentId,
  agreementQuery: AgreementQuery,
  authData: AuthData,
  fileRemove: FileManager["delete"],
  correlationId: string,
  logger: Logger
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

  await fileRemove(config.s3Bucket, existentDocument.path, logger);

  const updatedAgreement = {
    ...agreement.data,
    consumerDocuments: agreement.data.consumerDocuments.filter(
      (d) => d.id !== documentId
    ),
  };

  return toCreateEventAgreementConsumerDocumentRemoved(
    documentId,
    updatedAgreement,
    agreement.metadata.version,
    correlationId
  );
}
