import { describe, expect, it } from "vitest";
import {
  DelegationId,
  generateId,
  Purpose,
  PurposeRiskAnalysisForm,
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
} from "pagopa-interop-commons-test/index.js";
import { purposeSQLToPurpose } from "../src/purpose/aggregators.js";
import { splitPurposeIntoObjectsSQL } from "../src/purpose/splitters.js";

describe("Purpose aggregator", () => {
  it("should convert complete purpose SQL objects into a business logic purpose", () => {
    const delegationId = generateId<DelegationId>();
    const freeOfChargeReason = "Free of charge reason";
    const rejectionReason = "Rejection reason";
    const suspendedAt = new Date();
    const updatedAt = new Date();
    const firstActivationAt = new Date();
    const riskAnalysisId = generateId<RiskAnalysisId>();

    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      rejectionReason,
      suspendedAt,
      updatedAt,
      firstActivationAt,
      riskAnalysis: getMockPurposeVersionDocument(),
    };

    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId,
    };

    const purpose: WithMetadata<Purpose> = {
      data: {
        ...getMockPurpose(),
        delegationId,
        suspendedByConsumer: false,
        suspendedByProducer: false,
        updatedAt,
        freeOfChargeReason,
        riskAnalysisForm: purposeRiskAnalysisForm,
        versions: [purposeVersion],
      },
      metadata: { version: 1 },
    };

    const {
      purposeSQL,
      purposeRiskAnalysisFormSQL,
      purposeRiskAnalysisAnswersSQL,
      purposeVersionsSQL,
      purposeVersionDocumentsSQL,
    } = splitPurposeIntoObjectsSQL(purpose.data, 1);

    const aggregatedPurpose = purposeSQLToPurpose({
      purposeSQL,
      purposeRiskAnalysisFormSQL,
      purposeRiskAnalysisAnswersSQL,
      purposeVersionsSQL,
      purposeVersionDocumentsSQL,
    });

    expect(aggregatedPurpose).toEqual(purpose);
  });

  it("should convert incomplete purpose SQL objects into a business logic purpose (null -> undefined)", () => {
    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      rejectionReason: undefined,
      suspendedAt: undefined,
      updatedAt: undefined,
      firstActivationAt: undefined,
      riskAnalysis: getMockPurposeVersionDocument(),
    };

    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm =
      getMockValidRiskAnalysisForm(tenantKind.PA);

    const purpose: WithMetadata<Purpose> = {
      data: {
        ...getMockPurpose(),
        delegationId: undefined,
        suspendedByConsumer: undefined,
        suspendedByProducer: undefined,
        updatedAt: undefined,
        freeOfChargeReason: undefined,
        riskAnalysisForm: purposeRiskAnalysisForm,
        versions: [purposeVersion],
      },
      metadata: { version: 1 },
    };

    const {
      purposeSQL,
      purposeRiskAnalysisFormSQL,
      purposeRiskAnalysisAnswersSQL,
      purposeVersionsSQL,
      purposeVersionDocumentsSQL,
    } = splitPurposeIntoObjectsSQL(purpose.data, 1);

    const aggregatedPurpose = purposeSQLToPurpose({
      purposeSQL,
      purposeRiskAnalysisFormSQL,
      purposeRiskAnalysisAnswersSQL,
      purposeVersionsSQL,
      purposeVersionDocumentsSQL,
    });

    expect(aggregatedPurpose).toEqual(purpose);
  });
});
