/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockValidRiskAnalysisForm,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import {
  DelegationId,
  generateId,
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  purposeVersionState,
  riskAnalysisAnswerKind,
  RiskAnalysisId,
  stringToDate,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  PurposeRiskAnalysisAnswerSQL,
  PurposeRiskAnalysisFormSQL,
  PurposeSQL,
  PurposeVersionDocumentSQL,
  PurposeVersionSQL,
} from "pagopa-interop-readmodel-models";
import { purposeReadModelServiceBuilder } from "../src/purposeReadModelServiceSQL.js";
import {
  retrievePurposeRiskAnalysisAnswersSQL,
  retrievePurposeRiskAnalysisForm,
  retrievePurposeSQL,
  retrievePurposeVersionDocumentSQL,
  retrievePurposeVersionsSQL,
} from "./purposeTestReadModelService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const purposeReadModelService =
  purposeReadModelServiceBuilder(readModelDB);

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}

export const initMockPurpose = (
  isPurposeComplete: boolean
): {
  purposeBeforeUpdate: WithMetadata<Purpose>;
  purpose: WithMetadata<Purpose>;
  purposeVersions: PurposeVersion[];
} => {
  const purposeVersionDocument1 = getMockPurposeVersionDocument();
  const purposeVersion1: PurposeVersion = {
    ...getMockPurposeVersion(purposeVersionState.draft),
    ...(isPurposeComplete
      ? {
          riskAnalysis: purposeVersionDocument1,
          rejectionReason: "Test rejection reason",
          updatedAt: new Date(),
          firstActivationAt: new Date(),
          suspendedAt: new Date(),
        }
      : {}),
  };
  if (!isPurposeComplete) {
    // eslint-disable-next-line fp/no-delete
    delete purposeVersion1.riskAnalysis;
  }

  const purposeVersionDocument2 = getMockPurposeVersionDocument();
  const purposeVersion2: PurposeVersion = {
    ...getMockPurposeVersion(purposeVersionState.draft),
    ...(isPurposeComplete
      ? {
          riskAnalysis: purposeVersionDocument2,
          rejectionReason: "Test rejection reason",
          updatedAt: new Date(),
          firstActivationAt: new Date(),
          suspendedAt: new Date(),
        }
      : {}),
  };
  if (!isPurposeComplete) {
    // eslint-disable-next-line fp/no-delete
    delete purposeVersion1.riskAnalysis;
  }
  const purposeVersions = [purposeVersion1, purposeVersion2];

  const purposeBeforeUpdate: WithMetadata<Purpose> = {
    data: {
      ...getMockPurpose(),
      // versions: [purposeVersion],
    },
    metadata: {
      version: 1,
    },
  };
  const riskAnalysisForm: PurposeRiskAnalysisForm = {
    ...getMockValidRiskAnalysisForm(tenantKind.PA),
    ...(isPurposeComplete
      ? { riskAnalysisId: generateId<RiskAnalysisId>() }
      : {}),
  };
  const purposeOptionalFields: Partial<Purpose> = isPurposeComplete
    ? {
        versions: purposeVersions,
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm,
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
      }
    : {};
  const purpose: WithMetadata<Purpose> = {
    ...purposeBeforeUpdate,
    data: {
      ...purposeBeforeUpdate.data,
      ...purposeOptionalFields,
    },
  };

  // TODO: need this because of getMockPurpose
  if (!isPurposeComplete) {
    // eslint-disable-next-line fp/no-delete
    delete purpose.data.freeOfChargeReason;
  }

  return {
    purposeBeforeUpdate,
    purpose,
    purposeVersions,
  };
};

export const retrievePurposeSQLObjects = async (
  purpose: Purpose,
  isPurposeComplete: boolean
): Promise<{
  retrievedPurposeSQL: PurposeSQL | undefined;
  retrieveRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL | undefined;
  retrievedRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] | undefined;
  retrievedPurposeVersionsSQL: PurposeVersionSQL[] | undefined;
  retrievedPurposeVersionDocumentsSQL: PurposeVersionDocumentSQL[] | undefined;
}> => {
  const retrievedPurposeSQL = await retrievePurposeSQL(purpose.id, readModelDB);
  const retrievedAndFormattedPurposeSQL: PurposeSQL | undefined =
    retrievedPurposeSQL
      ? {
          ...retrievedPurposeSQL,
          createdAt: stringToISOString(retrievedPurposeSQL.createdAt),
          updatedAt: stringToISOString(retrievedPurposeSQL.updatedAt),
        }
      : undefined;
  const retrieveRiskAnalysisFormSQL = isPurposeComplete
    ? await retrievePurposeRiskAnalysisForm(purpose.id, readModelDB)
    : undefined;
  const retrievedRiskAnalysisAnswersSQL = retrieveRiskAnalysisFormSQL
    ? await retrievePurposeRiskAnalysisAnswersSQL(purpose.id, readModelDB)
    : undefined;
  const retrievedPurposeVersionsSQL = await retrievePurposeVersionsSQL(
    purpose.id,
    readModelDB
  );
  const retrievedAndFormattedPurposeVersionsSQL:
    | PurposeVersionSQL[]
    | undefined = retrievedPurposeVersionsSQL
    ? retrievedPurposeVersionsSQL.map((pvSQL) => ({
        ...pvSQL,
        createdAt: stringToISOString(pvSQL.createdAt),
        updatedAt: stringToISOString(pvSQL.updatedAt),
        firstActivationAt: stringToISOString(pvSQL.firstActivationAt),
        suspendedAt: stringToISOString(pvSQL.suspendedAt),
      }))
    : undefined;
  const retrievedPurposeVersionDocumentSQL =
    await retrievePurposeVersionDocumentSQL(purpose.id, readModelDB);
  const retrievedAndFormattedPurposeVersionDocumentSQL:
    | PurposeVersionDocumentSQL[]
    | undefined = retrievedPurposeVersionDocumentSQL?.map((docSQL) => ({
    ...docSQL,
    createdAt: stringToISOString(docSQL.createdAt),
  }));

  return {
    retrievedPurposeSQL: retrievedAndFormattedPurposeSQL,
    retrieveRiskAnalysisFormSQL,
    retrievedRiskAnalysisAnswersSQL,
    retrievedPurposeVersionsSQL: retrievedAndFormattedPurposeVersionsSQL,
    retrievedPurposeVersionDocumentsSQL:
      retrievedAndFormattedPurposeVersionDocumentSQL,
  };
};

export const generateCompleteExpectedPurposeSQLObjects = ({
  purpose,
  purposeVersions,
}: {
  purpose: WithMetadata<Purpose>;
  purposeVersions: PurposeVersion[];
}): {
  expectedPurposeSQL: PurposeSQL;
  expectedRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL;
  expectedRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[];
  expectedPurposeVersionsSQL: PurposeVersionSQL[];
  expectedPurposeVersionDocumentsSQL: PurposeVersionDocumentSQL[];
} => {
  const expectedPurposeSQL: PurposeSQL = {
    id: purpose.data.id,
    metadataVersion: purpose.metadata.version,
    eserviceId: purpose.data.eserviceId,
    consumerId: purpose.data.consumerId,
    delegationId: purpose.data.delegationId!,
    suspendedByConsumer: purpose.data.suspendedByConsumer!,
    suspendedByProducer: purpose.data.suspendedByProducer!,
    title: purpose.data.title,
    description: purpose.data.description,
    createdAt: purpose.data.createdAt.toISOString(),
    updatedAt: purpose.data.updatedAt!.toISOString(),
    isFreeOfCharge: purpose.data.isFreeOfCharge,
    freeOfChargeReason: purpose.data.freeOfChargeReason!,
  };
  const expectedRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
    id: purpose.data.riskAnalysisForm!.id,
    purposeId: purpose.data.id,
    metadataVersion: purpose.metadata.version,
    version: purpose.data.riskAnalysisForm!.version,
    riskAnalysisId: purpose.data.riskAnalysisForm!.riskAnalysisId!,
  };
  const expectedRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] = [
    ...purpose.data.riskAnalysisForm!.singleAnswers.map((a) => ({
      id: a.id,
      purposeId: purpose.data.id,
      metadataVersion: purpose.metadata.version,
      riskAnalysisFormId: purpose.data.riskAnalysisForm!.id,
      kind: riskAnalysisAnswerKind.single,
      key: a.key,
      value: a.value ? [a.value] : [],
    })),
    ...purpose.data.riskAnalysisForm!.multiAnswers.map((a) => ({
      id: a.id,
      purposeId: purpose.data.id,
      metadataVersion: purpose.metadata.version,
      riskAnalysisFormId: purpose.data.riskAnalysisForm!.id,
      kind: riskAnalysisAnswerKind.multi,
      key: a.key,
      value: a.values,
    })),
  ];
  const { expectedPurposeVersionsSQL, expectedPurposeVersionDocumentsSQL } =
    purposeVersions.reduce(
      (
        acc: {
          expectedPurposeVersionsSQL: PurposeVersionSQL[];
          expectedPurposeVersionDocumentsSQL: PurposeVersionDocumentSQL[];
        },
        purposeVersion
      ) => ({
        expectedPurposeVersionsSQL: [
          ...acc.expectedPurposeVersionsSQL,
          {
            id: purposeVersion.id,
            purposeId: purpose.data.id,
            metadataVersion: purpose.metadata.version,
            state: purposeVersion.state,
            dailyCalls: purposeVersion.dailyCalls,
            rejectionReason: purposeVersion.rejectionReason || null,
            createdAt: purposeVersion.createdAt.toISOString(),
            updatedAt: purposeVersion.updatedAt!.toISOString(),
            firstActivationAt: purposeVersion.firstActivationAt!.toISOString(),
            suspendedAt: purposeVersion.suspendedAt!.toISOString(),
          },
        ],
        expectedPurposeVersionDocumentsSQL: [
          ...acc.expectedPurposeVersionDocumentsSQL,
          {
            purposeId: purpose.data.id,
            metadataVersion: purpose.metadata.version,
            purposeVersionId: purposeVersion.id,
            id: purposeVersion.riskAnalysis!.id,
            contentType: purposeVersion.riskAnalysis!.contentType,
            path: purposeVersion.riskAnalysis!.path,
            createdAt: purposeVersion.riskAnalysis!.createdAt.toISOString(),
          },
        ],
      }),
      {
        expectedPurposeVersionsSQL: [],
        expectedPurposeVersionDocumentsSQL: [],
      }
    );
  return {
    expectedPurposeSQL,
    expectedRiskAnalysisFormSQL,
    expectedRiskAnalysisAnswersSQL,
    expectedPurposeVersionsSQL,
    expectedPurposeVersionDocumentsSQL,
  };
};
