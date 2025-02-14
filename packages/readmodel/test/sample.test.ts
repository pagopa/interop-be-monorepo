import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  DelegationId,
  generateId,
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  PurposeVersionDocument,
  riskAnalysisAnswerKind,
  tenantKind,
} from "pagopa-interop-models";
import { splitPurposeIntoObjectsSQL } from "../src/purpose/splitters.js";
import {
  PurposeRiskAnalysisAnswerSQL,
  PurposeRiskAnalysisFormSQL,
  PurposeSQL,
  PurposeVersionDocumentSQL,
  PurposeVersionSQL,
} from "../src/types.js";

describe("Purpose SQL splitter", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should convert a complete purpose into purpose SQL objects", () => {
    const delegationId = generateId<DelegationId>();
    const freeOfChargeReason = "Free of charge reason";
    const rejectionReason = "Rejection reason";

    const purposeVersionRiskAnalysis: PurposeVersionDocument =
      getMockPurposeVersionDocument();

    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      rejectionReason,
      suspendedAt: new Date(),
      updatedAt: new Date(),
      firstActivationAt: new Date(),
      riskAnalysis: purposeVersionRiskAnalysis,
    };

    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm =
      getMockValidRiskAnalysisForm(tenantKind.PA);

    const purpose: Purpose = {
      ...getMockPurpose(),
      delegationId,
      suspendedByConsumer: false,
      suspendedByProducer: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      freeOfChargeReason,
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [purposeVersion],
    };

    const {
      purposeSQL,
      purposeRiskAnalysisFormSQL,
      purposeRiskAnalysisAnswersSQL,
      purposeVersionsSQL,
      purposeVersionDocumentsSQL,
    } = splitPurposeIntoObjectsSQL(purpose, 1);

    const expectedPurposeSQL: PurposeSQL = {
      metadataVersion: 1,
      delegationId,
      suspendedByConsumer: false,
      suspendedByProducer: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      freeOfChargeReason,
      id: purpose.id,
      eserviceId: purpose.eserviceId,
      consumerId: purpose.consumerId,
      title: purpose.title,
      description: purpose.description,
      isFreeOfCharge: purpose.isFreeOfCharge,
    };

    const expectedPurposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
      metadataVersion: 1,
      purposeId: purpose.id,
      id: purposeRiskAnalysisForm.id,
      version: purposeRiskAnalysisForm.version,
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
      createdAt: new Date().toISOString(),
      suspendedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstActivationAt: new Date().toISOString(),
      rejectionReason,
      id: purposeVersion.id,
      state: purposeVersion.state,
      dailyCalls: purposeVersion.dailyCalls,
    };

    const expectedPurposeVersionDocumentSQL: PurposeVersionDocumentSQL = {
      ...purposeVersionRiskAnalysis,
      id: purposeVersionRiskAnalysis.id,
      metadataVersion: 1,
      purposeId: purpose.id,
      purposeVersionId: purposeVersion.id,
      createdAt: new Date().toISOString(),
    };

    expect(purposeSQL).toEqual(expectedPurposeSQL);
    expect(purposeRiskAnalysisFormSQL).toEqual(
      expectedPurposeRiskAnalysisFormSQL
    );
    expect(purposeRiskAnalysisAnswersSQL).toEqual(
      expect.arrayContaining(expectedPurposeRiskAnalysisAnswersSQL)
    );
    expect(purposeVersionsSQL).toEqual([expectedPurposeVersionSQL]);
    expect(purposeVersionDocumentsSQL).toEqual([
      expectedPurposeVersionDocumentSQL,
    ]);
  });

  it("should convert an incomplete purpose into purpose SQL objects", () => {
    const purposeVersionRiskAnalysis: PurposeVersionDocument =
      getMockPurposeVersionDocument();

    const purposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      rejectionReason: undefined,
      suspendedAt: undefined,
      updatedAt: undefined,
      firstActivationAt: undefined,
      riskAnalysis: purposeVersionRiskAnalysis,
    };

    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm =
      getMockValidRiskAnalysisForm(tenantKind.PA);

    const purpose: Purpose = {
      ...getMockPurpose(),
      delegationId: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      createdAt: new Date(),
      updatedAt: undefined,
      freeOfChargeReason: undefined,
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [purposeVersion],
    };

    const {
      purposeSQL,
      purposeRiskAnalysisFormSQL,
      purposeRiskAnalysisAnswersSQL,
      purposeVersionsSQL,
      purposeVersionDocumentsSQL,
    } = splitPurposeIntoObjectsSQL(purpose, 1);

    const expectedPurposeSQL: PurposeSQL = {
      metadataVersion: 1,
      delegationId: null,
      suspendedByConsumer: null,
      suspendedByProducer: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      freeOfChargeReason: null,
      id: purpose.id,
      eserviceId: purpose.eserviceId,
      consumerId: purpose.consumerId,
      title: purpose.title,
      description: purpose.description,
      isFreeOfCharge: purpose.isFreeOfCharge,
    };

    const expectedPurposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
      metadataVersion: 1,
      purposeId: purpose.id,
      id: purposeRiskAnalysisForm.id,
      version: purposeRiskAnalysisForm.version,
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
      createdAt: new Date().toISOString(),
      suspendedAt: null,
      updatedAt: null,
      firstActivationAt: null,
      rejectionReason: null,
      id: purposeVersion.id,
      state: purposeVersion.state,
      dailyCalls: purposeVersion.dailyCalls,
    };

    const expectedPurposeVersionDocumentSQL: PurposeVersionDocumentSQL = {
      ...purposeVersionRiskAnalysis,
      id: purposeVersionRiskAnalysis.id,
      metadataVersion: 1,
      purposeId: purpose.id,
      purposeVersionId: purposeVersion.id,
      createdAt: new Date().toISOString(),
    };

    expect(purposeSQL).toEqual(expectedPurposeSQL);
    expect(purposeRiskAnalysisFormSQL).toEqual(
      expectedPurposeRiskAnalysisFormSQL
    );
    expect(purposeRiskAnalysisAnswersSQL).toEqual(
      expect.arrayContaining(expectedPurposeRiskAnalysisAnswersSQL)
    );
    expect(purposeVersionsSQL).toEqual([expectedPurposeVersionSQL]);
    expect(purposeVersionDocumentsSQL).toEqual([
      expectedPurposeVersionDocumentSQL,
    ]);
  });
});
