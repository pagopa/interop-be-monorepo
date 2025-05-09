import { eq } from "drizzle-orm";
import { GenericCollection } from "pagopa-interop-commons";
import { Agreement } from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitAgreementIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";

/**
 * This function provides a convenient way to write data into a read model
 * by inserting it into a specified collection with an optional version number.
 *
 * @param data
 * @param collection
 * @param version
 */
export const writeInReadmodel = async <T>(
  data: T,
  collection: GenericCollection<T>,
  version: number = 0
): Promise<void> => {
  await collection.insertOne({
    data,
    metadata: {
      version,
    },
  });
};

export const addOneAgreementSQL = async (
  readModelDB: DrizzleReturnType,
  agreement: Agreement,
  metadataVersion: number
): Promise<void> => {
  const {
    agreementSQL,
    stampsSQL,
    attributesSQL,
    consumerDocumentsSQL,
    contractSQL,
  } = splitAgreementIntoObjectsSQL(agreement, metadataVersion);

  await readModelDB.transaction(async (tx) => {
    const shouldUpsert = await checkMetadataVersion(
      tx,
      agreementInReadmodelAgreement,
      metadataVersion,
      agreement.id
    );

    if (!shouldUpsert) {
      return;
    }

    await tx
      .delete(agreementInReadmodelAgreement)
      .where(eq(agreementInReadmodelAgreement.id, agreement.id));

    await tx.insert(agreementInReadmodelAgreement).values(agreementSQL);

    for (const stampSQL of stampsSQL) {
      await tx.insert(agreementStampInReadmodelAgreement).values(stampSQL);
    }

    for (const attributeSQL of attributesSQL) {
      await tx
        .insert(agreementAttributeInReadmodelAgreement)
        .values(attributeSQL);
    }

    for (const docSQL of consumerDocumentsSQL) {
      await tx
        .insert(agreementConsumerDocumentInReadmodelAgreement)
        .values(docSQL);
    }
    if (contractSQL !== undefined) {
      await tx
        .insert(agreementContractInReadmodelAgreement)
        .values(contractSQL);
    }
  });
};
