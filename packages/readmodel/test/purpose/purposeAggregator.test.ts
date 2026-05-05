import { describe, expect, it } from "vitest";
import {
  DelegationId,
  generateId,
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeTemplateId,
  PurposeVersion,
  RiskAnalysisId,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import { aggregatePurpose } from "../../src/purpose/aggregators.js";
import { splitPurposeIntoObjectsSQL } from "../../src/purpose/splitters.js";

describe("Purpose aggregator", () => {
  it("should convert complete purpose SQL objects into a business logic purpose", () => {
    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      rejectionReason: "Rejection reason",
      suspendedAt: new Date(),
      updatedAt: new Date(),
      firstActivationAt: new Date(),
      riskAnalysis: getMockPurposeVersionDocument(),
    };

    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId: generateId<RiskAnalysisId>(),
    };

    const purpose: WithMetadata<Purpose> = {
      data: {
        ...getMockPurpose(),
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        updatedAt: new Date(),
        freeOfChargeReason: "Free of charge reason",
        riskAnalysisForm: purposeRiskAnalysisForm,
        versions: [purposeVersion],
        purposeTemplateId: generateId<PurposeTemplateId>(),
      },
      metadata: { version: 1 },
    };

    const {
      purposeSQL,
      riskAnalysisFormSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      versionDocumentsSQL,
      versionStampsSQL,
      versionSignedDocumentsSQL,
    } = splitPurposeIntoObjectsSQL(purpose.data, 1);

    const aggregatedPurpose = aggregatePurpose({
      purposeSQL,
      riskAnalysisFormSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      versionDocumentsSQL,
      versionStampsSQL,
      versionSignedDocumentsSQL,
    });

    expect(aggregatedPurpose).toStrictEqual(purpose);
  });

  it("should convert incomplete purpose SQL objects into a business logic purpose (null -> undefined)", () => {
    const purpose: WithMetadata<Purpose> = {
      data: {
        ...getMockPurpose(),
      },
      metadata: { version: 1 },
    };

    const {
      purposeSQL,
      riskAnalysisFormSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      versionDocumentsSQL,
      versionStampsSQL,
      versionSignedDocumentsSQL,
    } = splitPurposeIntoObjectsSQL(purpose.data, 1);

    const aggregatedPurpose = aggregatePurpose({
      purposeSQL,
      riskAnalysisFormSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      versionDocumentsSQL,
      versionStampsSQL,
      versionSignedDocumentsSQL,
    });

    expect(aggregatedPurpose).toStrictEqual(purpose);
  });
});
