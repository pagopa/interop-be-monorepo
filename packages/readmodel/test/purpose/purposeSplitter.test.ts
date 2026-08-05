/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockPurposeVersionSignedDocument,
  getMockPurposeVersionStamps,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
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
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  RiskAnalysisId,
  ReviewerWorkflow,
  RiskAnalysisReviewer,
  tenantKind,
  UserId,
} from "pagopa-interop-models";
import {
  PurposeRiskAnalysisAnswerSQL,
  PurposeRiskAnalysisFormSQL,
  RiskAnalysisReviewerSQL,
  PurposeSQL,
  PurposeVersionDocumentSQL,
  PurposeVersionSQL,
  PurposeVersionSignedDocumentSQL,
  PurposeVersionStampSQL,
} from "pagopa-interop-readmodel-models";
import { describe, it, expect } from "vitest";

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

    const reviewMode = riskAnalysisReviewMode.adminWritesReviewerSigns;
    const reviewers: RiskAnalysisReviewer[] = [
      { id: generateId<UserId>(), sentToReviewerAt: new Date() },
      { id: generateId<UserId>(), sentToReviewerAt: new Date() },
    ];

    const reviewerWorkflow: ReviewerWorkflow = {
      reviewers,
      signingState: riskAnalysisSigningState.signed,
      signedBy: generateId<UserId>(),
      signedAt: new Date(),
      rejectedBy: generateId<UserId>(),
      rejectionReason: "Reviewer workflow rejection reason",
      sentToReviewerAt: new Date(),
    };

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
      reviewMode,
      reviewerWorkflow,
    };
    const {
      purposeSQL,
      riskAnalysisFormSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      versionDocumentsSQL,
      versionStampsSQL,
      versionSignedDocumentsSQL,
      reviewersSQL,
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
      reviewMode,
      reviewerWorkflowReviewMode: null,
      reviewerWorkflowSigningState: reviewerWorkflow.signingState,
      reviewerWorkflowSignedBy: reviewerWorkflow.signedBy!,
      reviewerWorkflowSignedAt: reviewerWorkflow.signedAt!.toISOString(),
      reviewerWorkflowRejectedBy: reviewerWorkflow.rejectedBy!,
      reviewerWorkflowRejectionReason: reviewerWorkflow.rejectionReason!,
      // the send date is stored per reviewer, the legacy column is left behind
      reviewerWorkflowSentToReviewerAt: null,
    };

    const expectedPurposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
      metadataVersion: 1,
      purposeId: purpose.id,
      id: purposeRiskAnalysisForm.id,
      version: purposeRiskAnalysisForm.version,
      riskAnalysisId,
      tenantKind: purposeRiskAnalysisForm.tenantKind!,
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
          })
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
            })
          )
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
      expectedPurposeRiskAnalysisFormSQL
    );
    expect(riskAnalysisAnswersSQL).toStrictEqual(
      expect.arrayContaining(expectedPurposeRiskAnalysisAnswersSQL)
    );
    expect(versionsSQL).toStrictEqual([expectedPurposeVersionSQL]);
    expect(versionDocumentsSQL).toStrictEqual([
      expectedPurposeVersionDocumentSQL,
    ]);
    expect(versionStampsSQL).toStrictEqual(expectedPurposeVersionStampsSQL);
    expect(versionSignedDocumentsSQL).toStrictEqual([
      expectedPurposeVersionSignedDocumentSQL,
    ]);
    const expectedReviewersSQL: RiskAnalysisReviewerSQL[] =
      reviewerWorkflow.reviewers.map((reviewer) => ({
        purposeId: purpose.id,
        metadataVersion: 1,
        reviewerId: reviewer.id,
        sentToReviewerAt: reviewer.sentToReviewerAt!.toISOString(),
      }));
    expect(reviewersSQL).toStrictEqual(expectedReviewersSQL);
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

    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      tenantKind: undefined,
    };

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
      reviewersSQL,
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
      reviewMode: null,
      reviewerWorkflowReviewMode: null,
      reviewerWorkflowSigningState: null,
      reviewerWorkflowSignedBy: null,
      reviewerWorkflowSignedAt: null,
      reviewerWorkflowRejectedBy: null,
      reviewerWorkflowRejectionReason: null,
      reviewerWorkflowSentToReviewerAt: null,
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
          })
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
            })
          )
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
      expectedPurposeRiskAnalysisFormSQL
    );
    expect(riskAnalysisAnswersSQL).toStrictEqual(
      expect.arrayContaining(expectedPurposeRiskAnalysisAnswersSQL)
    );
    expect(versionsSQL).toStrictEqual([expectedPurposeVersionSQL]);
    expect(versionDocumentsSQL).toStrictEqual([
      expectedPurposeVersionDocumentSQL,
    ]);
    expect(versionStampsSQL).toStrictEqual(expectedpurposeVersionStampsSQL);
    expect(versionSignedDocumentsSQL).toStrictEqual([
      expectedPurposeVersionSignedDocumentSQL,
    ]);
    expect(reviewersSQL).toStrictEqual([]);
  });
});
