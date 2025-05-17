/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  AgreementEventEnvelopeV1,
  AgreementId,
  unsafeBrandId,
  genericInternalError,
  fromAgreementV1,
  fromAgreementDocumentV1,
} from "pagopa-interop-models";
import {
  AgreementItemsSQL,
  AgreementConsumerDocumentSQL,
  AgreementContractSQL,
} from "pagopa-interop-readmodel-models";
import {
  agreementDocumentToAgreementDocumentSQL,
  splitAgreementIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import { agreementServiceBuilder } from "../../service/agreementService.js";
import { DBContext } from "../../db/db.js";

export async function handleAgreementMessageV1(
  messages: AgreementEventEnvelopeV1[],
  dbContext: DBContext
): Promise<void> {
  const agreementService = agreementServiceBuilder(dbContext);

  const upsertAgreements: AgreementItemsSQL[] = [];
  const upsertDocs: AgreementConsumerDocumentSQL[] = [];
  const deleteDocs: string[] = [];
  const upsertContracts: AgreementContractSQL[] = [];
  const deleteAgreements: AgreementId[] = [];

  for (const msg of messages) {
    match(msg)
      .with(
        {
          type: P.union(
            "AgreementAdded",
            "AgreementUpdated",
            "AgreementActivated",
            "AgreementSuspended",
            "AgreementDeactivated",
            "VerifiedAttributeUpdated"
          ),
        },
        ({ data, version }) => {
          if (!data.agreement) {
            throw genericInternalError(
              `Agreement can't be missing in the event message`
            );
          }
          upsertAgreements.push(
            splitAgreementIntoObjectsSQL(
              fromAgreementV1(data.agreement),
              version
            )
          );
        }
      )

      .with({ type: "AgreementConsumerDocumentAdded" }, ({ data, version }) => {
        if (!data.document) {
          throw genericInternalError(
            `Agreement document can't be missing in the event message`
          );
        }
        const agreementDocument = agreementDocumentToAgreementDocumentSQL(
          fromAgreementDocumentV1(data.document),
          unsafeBrandId<AgreementId>(data.agreementId),
          version
        );
        upsertDocs.push(agreementDocument);
      })

      .with({ type: "AgreementConsumerDocumentRemoved" }, ({ data }) => {
        deleteDocs.push(data.documentId);
      })
      .with({ type: "AgreementContractAdded" }, ({ data, version }) => {
        if (!data.contract) {
          throw genericInternalError(
            `Agreement contract can't be missing in the event message`
          );
        }
        const agreementContract = agreementDocumentToAgreementDocumentSQL(
          fromAgreementDocumentV1(data.contract),
          unsafeBrandId<AgreementId>(data.agreementId),
          version
        );
        upsertContracts.push(agreementContract);
      })

      .with({ type: "AgreementDeleted" }, ({ data }) => {
        deleteAgreements.push(unsafeBrandId<AgreementId>(data.agreementId));
      })

      .exhaustive();
  }

  if (upsertAgreements.length) {
    await agreementService.upsertBatchAgreement(upsertAgreements, dbContext);
  }
  if (upsertDocs.length) {
    await agreementService.upsertBatchAgreementDocument(upsertDocs, dbContext);
  }
  if (upsertContracts.length) {
    await agreementService.upsertBatchAgreementContract(
      upsertContracts,
      dbContext
    );
  }
  if (deleteDocs.length) {
    await agreementService.deleteBatchAgreementDocument(deleteDocs, dbContext);
  }
  if (deleteAgreements.length) {
    await agreementService.deleteBatchAgreement(deleteAgreements, dbContext);
  }
}
