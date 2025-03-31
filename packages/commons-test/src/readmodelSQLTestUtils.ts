import { eq } from "drizzle-orm";
import {
  DrizzleReturnType,
  AgreementSQL,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  AgreementStampSQL,
  agreementAttributeInReadmodelAgreement,
  AgreementAttributeSQL,
  agreementConsumerDocumentInReadmodelAgreement,
  AgreementConsumerDocumentSQL,
  agreementContractInReadmodelAgreement,
  AgreementContractSQL,
  DrizzleTransactionType,
} from "pagopa-interop-readmodel-models";

export const addOneAgreementSQL = async (
  db: DrizzleReturnType | DrizzleTransactionType,
  agreementItemsSQL: {
    agreementSQL: AgreementSQL;
    stampsSQL: AgreementStampSQL[];
    attributesSQL: AgreementAttributeSQL[];
    consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
    contractSQL: AgreementContractSQL | undefined;
  }
): Promise<void> => {
  const {
    agreementSQL,
    consumerDocumentsSQL,
    contractSQL,
    attributesSQL,
    stampsSQL,
  } = agreementItemsSQL;
  await db.transaction(async (tx) => {
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

export const deleteOneAgreementSQL = async (
  db: DrizzleReturnType | DrizzleTransactionType,
  agreementSQL: AgreementSQL
): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx
      .delete(agreementInReadmodelAgreement)
      .where(eq(agreementInReadmodelAgreement.id, agreementSQL.id));
  });
};

export const updateOneAgreementSQL = async (
  db: DrizzleReturnType,
  agreementItemsSQL: {
    agreementSQL: AgreementSQL;
    stampsSQL: AgreementStampSQL[];
    attributesSQL: AgreementAttributeSQL[];
    consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
    contractSQL: AgreementContractSQL | undefined;
  }
): Promise<void> => {
  const { agreementSQL } = agreementItemsSQL;
  await db.transaction(async (tx) => {
    await deleteOneAgreementSQL(tx, agreementSQL);
    await addOneAgreementSQL(tx, agreementItemsSQL);
  });
};
