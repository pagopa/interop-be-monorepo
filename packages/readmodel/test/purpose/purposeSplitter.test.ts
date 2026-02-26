/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockPurposeVersionSignedDocument,
  getMockPurposeVersionStamps,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import {
  DelegationId,
  generateId,
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeTemplateId,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionSignedDocument,
  PurposeVersionStampKind,
  PurposeVersionStamps,
  purposeVersionState,
  riskAnalysisAnswerKind,
  RiskAnalysisId,
  tenantKind,
} from "pagopa-interop-models";
import {
  PurposeRiskAnalysisAnswerSQL,
  PurposeRiskAnalysisFormSQL,
  PurposeSQL,
  PurposeVersionDocumentSQL,
  PurposeVersionSQL,
  PurposeVersionSignedDocumentSQL,
  PurposeVersionStampSQL,
} from "pagopa-interop-readmodel-models";
import { splitPurposeIntoObjectsSQL } from "../../src/purpose/splitters.js";

describe("Purpose splitter", () => {
  it("should convert a complete purpose into purpose SQL objects", () => {
    const delegationId = generateId<DelegationId>();
    const freeOfChargeReason = "Free of charge reason";
    const rejectionReason = "Rejection reason";
    const suspendedAt = new Date();
    const updatedAt = new Date();
    const firstActivationAt = new Date();
    const riskAnalysisId = generateId<RiskAnalysisId>();

    const purposeVersionRiskAnalysis: PurposeVersionDocument =
      getMockPurposeVersionDocument();
    const purposeVersionSignedContract: PurposeVersionSignedDocument =
      getMockPurposeVersionSignedDocument();

    const purposeVersionStamps = getMockPurposeVersionStamps();
    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(purposeVersionState.draft, purposeVersionStamps),
      rejectionReason,
      suspendedAt,
      updatedAt,
      firstActivationAt,
      riskAnalysis: purposeVersionRiskAnalysis,
      signedContract: purposeVersionSignedContract,
    };

    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId,
    };

    const purpose: Purpose = {
      ...getMockPurpose(),
      delegationId,
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt,
      freeOfChargeReason,
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [purposeVersion],
      purposeTemplateId: generateId<PurposeTemplateId>(),
    };
    const {
      purposeSQL,
      riskAnalysisFormSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      versionDocumentsSQL,
      versionStampsSQL,
      versionSignedDocumentsSQL,
    } = splitPurposeIntoObjectsSQL(purpose, 1);

    const expectedPurposeSQL: PurposeSQL = {
      metadataVersion: 1,
      delegationId,
      suspendedByConsumer: false,
      suspendedByProducer: false,
      createdAt: purpose.createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      freeOfChargeReason,
      id: purpose.id,
      eserviceId: purpose.eserviceId,
      consumerId: purpose.consumerId,
      title: purpose.title,
      description: purpose.description,
      isFreeOfCharge: purpose.isFreeOfCharge,
      purposeTemplateId: purpose.purposeTemplateId!,
    };

    const expectedPurposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
      metadataVersion: 1,
      purposeId: purpose.id,
      id: purposeRiskAnalysisForm.id,
      version: purposeRiskAnalysisForm.version,
      riskAnalysisId,
      tenantKind: purposeRiskAnalysisForm.tenantKind ?? null,
    };

    const expectedPurposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] =
      purposeRiskAnalysisForm.singleAnswers
        .map(
          (a): PurposeRiskAnalysisAnswerSQL => ({
            id: a.id,
            purposeId: purpose.id,
            metadataVersion: 1,
            key: a.key,
            value: a.value ? [a.value] : [],
            riskAnalysisFormId: purposeRiskAnalysisForm.id,
            kind: riskAnalysisAnswerKind.single,
          }),
        )
        .concat(
          purposeRiskAnalysisForm.multiAnswers.map(
            (a): PurposeRiskAnalysisAnswerSQL => ({
              id: a.id,
              purposeId: purpose.id,
              metadataVersion: 1,
              key: a.key,
              value: a.values,
              riskAnalysisFormId: purposeRiskAnalysisForm.id,
              kind: riskAnalysisAnswerKind.multi,
            }),
          ),
        );

    const expectedPurposeVersionSQL: PurposeVersionSQL = {
      metadataVersion: 1,
      purposeId: purpose.id,
      createdAt: purposeVersion.createdAt.toISOString(),
      suspendedAt: suspendedAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      firstActivationAt: firstActivationAt.toISOString(),
      rejectionReason,
      id: purposeVersion.id,
      state: purposeVersion.state,
      dailyCalls: purposeVersion.dailyCalls,
    };

    const expectedPurposeVersionDocumentSQL: PurposeVersionDocumentSQL = {
      id: purposeVersionRiskAnalysis.id,
      metadataVersion: 1,
      purposeId: purpose.id,
      purposeVersionId: purposeVersion.id,
      createdAt: purposeVersionRiskAnalysis.createdAt.toISOString(),
      contentType: purposeVersionRiskAnalysis.contentType,
      path: purposeVersionRiskAnalysis.path,
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    };

    const expectedPurposeVersionSignedDocumentSQL: PurposeVersionSignedDocumentSQL =
      {
        id: purposeVersionSignedContract.id,
        metadataVersion: 1,
        purposeId: purpose.id,
        purposeVersionId: purposeVersion.id,
        createdAt: purposeVersionSignedContract.createdAt.toISOString(),
        contentType: purposeVersionSignedContract.contentType,
        path: purposeVersionSignedContract.path,
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        signedAt: purposeVersionSignedContract.signedAt?.toISOString()!,
      };

    const expectedPurposeVersionStampsSQL: PurposeVersionStampSQL[] = [];

    for (const [key, stamp] of Object.entries(purposeVersionStamps) as Array<
      [
        keyof PurposeVersionStamps,
        PurposeVersionStamps[keyof PurposeVersionStamps],
      ]
    >) {
      if (stamp) {
        expectedPurposeVersionStampsSQL.push({
          purposeId: purpose.id,
          purposeVersionId: purposeVersion.id,
          metadataVersion: 1,
          kind: PurposeVersionStampKind.enum[key],
          who: stamp.who,
          when: stamp.when.toISOString(),
        });
      }
    }

    expect(purposeSQL).toStrictEqual(expectedPurposeSQL);
    expect(riskAnalysisFormSQL).toStrictEqual(
      expectedPurposeRiskAnalysisFormSQL,
    );
    expect(riskAnalysisAnswersSQL).toStrictEqual(
      expect.arrayContaining(expectedPurposeRiskAnalysisAnswersSQL),
    );
    expect(versionsSQL).toStrictEqual([expectedPurposeVersionSQL]);
    expect(versionDocumentsSQL).toStrictEqual([
      expectedPurposeVersionDocumentSQL,
    ]);
    expect(versionStampsSQL).toStrictEqual(expectedPurposeVersionStampsSQL);
    expect(versionSignedDocumentsSQL).toStrictEqual([
      expectedPurposeVersionSignedDocumentSQL,
    ]);
  });

  it("should convert an incomplete purpose into purpose SQL objects (undefined -> null)", () => {
    const purposeVersionRiskAnalysis: PurposeVersionDocument =
      getMockPurposeVersionDocument();

    const purposeVersionSignedDocument: PurposeVersionSignedDocument =
      getMockPurposeVersionSignedDocument();

    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      rejectionReason: undefined,
      suspendedAt: undefined,
      updatedAt: undefined,
      firstActivationAt: undefined,
      riskAnalysis: purposeVersionRiskAnalysis,
      stamps: undefined,
      signedContract: purposeVersionSignedDocument,
    };

    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm =
      getMockValidRiskAnalysisForm(tenantKind.PA);

    const purpose: Purpose = {
      ...getMockPurpose(),
      delegationId: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: undefined,
      freeOfChargeReason: undefined,
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [purposeVersion],
    };

    const {
      purposeSQL,
      riskAnalysisFormSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      versionDocumentsSQL,
      versionStampsSQL,
      versionSignedDocumentsSQL,
    } = splitPurposeIntoObjectsSQL(purpose, 1);

    const expectedPurposeSQL: PurposeSQL = {
      metadataVersion: 1,
      delegationId: null,
      suspendedByConsumer: null,
      suspendedByProducer: null,
      createdAt: purpose.createdAt.toISOString(),
      updatedAt: null,
      freeOfChargeReason: null,
      id: purpose.id,
      eserviceId: purpose.eserviceId,
      consumerId: purpose.consumerId,
      title: purpose.title,
      description: purpose.description,
      isFreeOfCharge: purpose.isFreeOfCharge,
      purposeTemplateId: null,
    };

    const expectedPurposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
      metadataVersion: 1,
      purposeId: purpose.id,
      id: purposeRiskAnalysisForm.id,
      version: purposeRiskAnalysisForm.version,
      riskAnalysisId: null,
      tenantKind: null,
    };

    const expectedPurposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] =
      purposeRiskAnalysisForm.singleAnswers
        .map(
          (a): PurposeRiskAnalysisAnswerSQL => ({
            id: a.id,
            purposeId: purpose.id,
            metadataVersion: 1,
            key: a.key,
            value: a.value ? [a.value] : [],
            riskAnalysisFormId: purposeRiskAnalysisForm.id,
            kind: riskAnalysisAnswerKind.single,
          }),
        )
        .concat(
          purposeRiskAnalysisForm.multiAnswers.map(
            (a): PurposeRiskAnalysisAnswerSQL => ({
              id: a.id,
              purposeId: purpose.id,
              metadataVersion: 1,
              key: a.key,
              value: a.values,
              riskAnalysisFormId: purposeRiskAnalysisForm.id,
              kind: riskAnalysisAnswerKind.multi,
            }),
          ),
        );

    const expectedPurposeVersionSQL: PurposeVersionSQL = {
      metadataVersion: 1,
      purposeId: purpose.id,
      createdAt: purposeVersion.createdAt.toISOString(),
      suspendedAt: null,
      updatedAt: null,
      firstActivationAt: null,
      rejectionReason: null,
      id: purposeVersion.id,
      state: purposeVersion.state,
      dailyCalls: purposeVersion.dailyCalls,
    };

    const expectedPurposeVersionDocumentSQL: PurposeVersionDocumentSQL = {
      id: purposeVersionRiskAnalysis.id,
      metadataVersion: 1,
      purposeId: purpose.id,
      purposeVersionId: purposeVersion.id,
      createdAt: purposeVersionRiskAnalysis.createdAt.toISOString(),
      contentType: purposeVersionRiskAnalysis.contentType,
      path: purposeVersionRiskAnalysis.path,
    };
    const expectedPurposeVersionSignedDocumentSQL: PurposeVersionSignedDocumentSQL =
      {
        id: purposeVersionSignedDocument.id,
        metadataVersion: 1,
        purposeId: purpose.id,
        purposeVersionId: purposeVersion.id,
        createdAt: purposeVersionSignedDocument.createdAt.toISOString(),
        contentType: purposeVersionSignedDocument.contentType,
        path: purposeVersionSignedDocument.path,
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        signedAt: purposeVersionSignedDocument.signedAt?.toISOString()!,
      };

    const expectedpurposeVersionStampsSQL: PurposeVersion[] = [];

    expect(purposeSQL).toStrictEqual(expectedPurposeSQL);
    expect(riskAnalysisFormSQL).toStrictEqual(
      expectedPurposeRiskAnalysisFormSQL,
    );
    expect(riskAnalysisAnswersSQL).toStrictEqual(
      expect.arrayContaining(expectedPurposeRiskAnalysisAnswersSQL),
    );
    expect(versionsSQL).toStrictEqual([expectedPurposeVersionSQL]);
    expect(versionDocumentsSQL).toStrictEqual([
      expectedPurposeVersionDocumentSQL,
    ]);
    expect(versionStampsSQL).toStrictEqual(expectedpurposeVersionStampsSQL);
    expect(versionSignedDocumentsSQL).toStrictEqual([
      expectedPurposeVersionSignedDocumentSQL,
    ]);
  });
});
