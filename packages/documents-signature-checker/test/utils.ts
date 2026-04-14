import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  Agreement,
  dateToString,
  Delegation,
  Purpose,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  upsertAgreement,
  upsertDelegation,
} from "pagopa-interop-readmodel/testUtils";
import {
  purposeInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  purposeVersionSignedDocumentInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";

export const { cleanup, readModelDB, fileManager } =
  await setupTestContainersVitest(
    undefined,
    inject("fileManagerConfig"),
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export async function seedAgreement(agreement: Agreement): Promise<void> {
  await upsertAgreement(readModelDB, agreement, 0);
}

export async function seedDelegation(delegation: Delegation): Promise<void> {
  await upsertDelegation(readModelDB, delegation, 0);
}

export async function seedPurposeForDocumentCheck(
  purpose: Purpose
): Promise<void> {
  await readModelDB.transaction(async (transaction) => {
    await transaction.insert(purposeInReadmodelPurpose).values({
      id: purpose.id,
      metadataVersion: 0,
      eserviceId: purpose.eserviceId,
      consumerId: purpose.consumerId,
      delegationId: purpose.delegationId ?? null,
      suspendedByConsumer: purpose.suspendedByConsumer ?? null,
      suspendedByProducer: purpose.suspendedByProducer ?? null,
      title: purpose.title,
      description: purpose.description,
      createdAt: dateToString(purpose.createdAt),
      updatedAt: dateToString(purpose.updatedAt),
      isFreeOfCharge: purpose.isFreeOfCharge,
      freeOfChargeReason: purpose.freeOfChargeReason ?? null,
      purposeTemplateId: purpose.purposeTemplateId ?? null,
    });

    for (const purposeVersion of purpose.versions) {
      await transaction.insert(purposeVersionInReadmodelPurpose).values({
        id: purposeVersion.id,
        purposeId: purpose.id,
        metadataVersion: 0,
        state: purposeVersion.state,
        dailyCalls: purposeVersion.dailyCalls,
        rejectionReason: purposeVersion.rejectionReason ?? null,
        createdAt: dateToString(purposeVersion.createdAt),
        updatedAt: dateToString(purposeVersion.updatedAt),
        firstActivationAt: dateToString(purposeVersion.firstActivationAt),
        suspendedAt: dateToString(purposeVersion.suspendedAt),
      });

      if (purposeVersion.riskAnalysis) {
        await transaction
          .insert(purposeVersionDocumentInReadmodelPurpose)
          .values({
            purposeId: purpose.id,
            purposeVersionId: purposeVersion.id,
            metadataVersion: 0,
            id: purposeVersion.riskAnalysis.id,
            createdAt: dateToString(purposeVersion.riskAnalysis.createdAt),
            contentType: purposeVersion.riskAnalysis.contentType,
            path: purposeVersion.riskAnalysis.path,
          });
      }

      if (purposeVersion.signedContract) {
        await transaction
          .insert(purposeVersionSignedDocumentInReadmodelPurpose)
          .values({
            purposeId: purpose.id,
            purposeVersionId: purposeVersion.id,
            metadataVersion: 0,
            id: purposeVersion.signedContract.id,
            createdAt: dateToString(purposeVersion.signedContract.createdAt),
            contentType: purposeVersion.signedContract.contentType,
            path: purposeVersion.signedContract.path,
            signedAt: dateToString(purposeVersion.signedContract.signedAt),
          });
      }
    }
  });
}

export async function uploadToS3(
  bucket: string,
  path: string,
  content: Buffer
): Promise<string> {
  return fileManager.storeBytesByKey(bucket, path, content, genericLogger);
}
