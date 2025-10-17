/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockPurpose,
  getMockValidRiskAnalysisForm,
  getMockPurposeVersionStamps,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  DelegationId,
  tenantKind,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { aggregatePurpose } from "pagopa-interop-readmodel";
import { describe, it, expect } from "vitest";
import {
  checkCompletePurpose,
  purposeWriterService,
  readModelDB,
  retrievePurposeRiskAnalysisAnswersSQLById,
  retrievePurposeRiskAnalysisFormSQLById,
  retrievePurposeSQLById,
  retrievePurposeVersionDocumentsSQLById,
  retrievePurposeVersionsSQLById,
  retrievePurposeVersionStampsSQLById,
} from "./utils.js";

describe("Purpose queries", () => {
  describe("Upsert Purpose", () => {
    it("should add a complete (*all* fields) purpose", async () => {
      const purposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        riskAnalysis: getMockPurposeVersionDocument(),
        rejectionReason: "Test rejection reason",
        updatedAt: new Date(),
        firstActivationAt: new Date(),
        suspendedAt: new Date(),
      };
      const purposeVersion2: PurposeVersion = {
        ...getMockPurposeVersion(purposeVersionState.draft),
        riskAnalysis: getMockPurposeVersionDocument(),
        rejectionReason: "Test rejection reason",
        updatedAt: new Date(),
        firstActivationAt: new Date(),
        suspendedAt: new Date(),
      };
      const purposeVersion3: PurposeVersion = {
        ...getMockPurposeVersion(
          purposeVersionState.active,
          getMockPurposeVersionStamps()
        ),
        riskAnalysis: getMockPurposeVersionDocument(),
        rejectionReason: "Test rejection reason",
        updatedAt: new Date(),
        firstActivationAt: new Date(),
        suspendedAt: new Date(),
      };

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [purposeVersion1, purposeVersion2, purposeVersion3],
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
        purposeTemplateId: generateId<PurposeTemplateId>(),
      };

      await purposeWriterService.upsertPurpose(purpose, 1);

      const {
        purposeSQL,
        riskAnalysisFormSQL,
        riskAnalysisAnswersSQL,
        versionsSQL,
        versionDocumentsSQL,
        versionStampsSQL,
      } = await checkCompletePurpose(purpose);

      const retrievedPurpose = aggregatePurpose({
        purposeSQL,
        riskAnalysisFormSQL,
        riskAnalysisAnswersSQL,
        versionsSQL,
        versionDocumentsSQL,
        versionStampsSQL,
      });

      expect(retrievedPurpose).toStrictEqual({
        data: purpose,
        metadata: { version: 1 },
      });
    });

    it("should add a incomplete (*only* mandatory fields) purpose", async () => {
      const purpose = getMockPurpose();

      await purposeWriterService.upsertPurpose(purpose, 1);

      const retrievedPurposeSQL = await retrievePurposeSQLById(
        purpose.id,
        readModelDB
      );
      const retrievedRiskAnalysisFormSQL =
        await retrievePurposeRiskAnalysisFormSQLById(purpose.id, readModelDB);
      const retrievedRiskAnalysisAnswersSQL =
        await retrievePurposeRiskAnalysisAnswersSQLById(
          purpose.id,
          readModelDB
        );
      const retrievedPurposeVersionsSQL = await retrievePurposeVersionsSQLById(
        purpose.id,
        readModelDB
      );
      const retrievedPurposeVersionDocumentSQL =
        await retrievePurposeVersionDocumentsSQLById(purpose.id, readModelDB);

      const retrievedPurposeVersionStampSQL =
        await retrievePurposeVersionStampsSQLById(purpose.id, readModelDB);

      expect(retrievedPurposeSQL).toBeDefined();
      expect(retrievedRiskAnalysisFormSQL).toBeUndefined();
      expect(retrievedRiskAnalysisAnswersSQL).toHaveLength(0);
      expect(retrievedPurposeVersionsSQL).toHaveLength(0);
      expect(retrievedPurposeVersionDocumentSQL).toHaveLength(0);
      expect(retrievedPurposeVersionStampSQL).toHaveLength(0);

      const retrievedPurpose = aggregatePurpose({
        purposeSQL: retrievedPurposeSQL!,
        riskAnalysisFormSQL: retrievedRiskAnalysisFormSQL,
        riskAnalysisAnswersSQL: retrievedRiskAnalysisAnswersSQL,
        versionsSQL: retrievedPurposeVersionsSQL,
        versionDocumentsSQL: retrievedPurposeVersionDocumentSQL,
        versionStampsSQL: retrievedPurposeVersionStampSQL,
      });

      expect(retrievedPurpose).toStrictEqual({
        data: purpose,
        metadata: { version: 1 },
      });
    });

    it("should update a complete (*all* fields) purpose", async () => {
      const purposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        riskAnalysis: getMockPurposeVersionDocument(),
        rejectionReason: "Test rejection reason",
        updatedAt: new Date(),
        firstActivationAt: new Date(),
        suspendedAt: new Date(),
      };
      const purposeVersion2: PurposeVersion = {
        ...getMockPurposeVersion(purposeVersionState.draft),
        riskAnalysis: getMockPurposeVersionDocument(),
        rejectionReason: "Test rejection reason",
        updatedAt: new Date(),
        firstActivationAt: new Date(),
        suspendedAt: new Date(),
      };
      const purposeVersion3: PurposeVersion = {
        ...getMockPurposeVersion(
          purposeVersionState.active,
          getMockPurposeVersionStamps()
        ),
        riskAnalysis: getMockPurposeVersionDocument(),
        rejectionReason: "Test rejection reason",
        updatedAt: new Date(),
        firstActivationAt: new Date(),
        suspendedAt: new Date(),
      };

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [purposeVersion1, purposeVersion2, purposeVersion3],
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
        purposeTemplateId: generateId<PurposeTemplateId>(),
      };

      await purposeWriterService.upsertPurpose(purpose, 1);
      await purposeWriterService.upsertPurpose(purpose, 2);

      const {
        purposeSQL,
        riskAnalysisFormSQL,
        riskAnalysisAnswersSQL,
        versionsSQL,
        versionDocumentsSQL,
        versionStampsSQL,
      } = await checkCompletePurpose(purpose);

      const retrievedPurpose = aggregatePurpose({
        purposeSQL,
        riskAnalysisFormSQL,
        riskAnalysisAnswersSQL,
        versionsSQL,
        versionDocumentsSQL,
        versionStampsSQL,
      });

      expect(retrievedPurpose).toStrictEqual({
        data: purpose,
        metadata: { version: 2 },
      });
    });
  });

  describe("Delete a Purpose", () => {
    it("should delete a purpose by id", async () => {
      const purpose1: Purpose = {
        ...getMockPurpose(),
        versions: [
          {
            ...getMockPurposeVersion(),
            riskAnalysis: getMockPurposeVersionDocument(),
            rejectionReason: "Test rejection reason",
            updatedAt: new Date(),
            firstActivationAt: new Date(),
            suspendedAt: new Date(),
          },
          {
            ...getMockPurposeVersion(),
            riskAnalysis: getMockPurposeVersionDocument(),
            rejectionReason: "Test rejection reason",
            updatedAt: new Date(),
            firstActivationAt: new Date(),
            suspendedAt: new Date(),
          },
          {
            ...getMockPurposeVersion(
              purposeVersionState.active,
              getMockPurposeVersionStamps()
            ),
            riskAnalysis: getMockPurposeVersionDocument(),
            rejectionReason: "Test rejection reason",
            updatedAt: new Date(),
            firstActivationAt: new Date(),
            suspendedAt: new Date(),
          },
        ],
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
        purposeTemplateId: generateId<PurposeTemplateId>(),
      };
      await purposeWriterService.upsertPurpose(purpose1, 1);
      await checkCompletePurpose(purpose1);

      const purpose2: Purpose = {
        ...getMockPurpose(),
        versions: [
          {
            ...getMockPurposeVersion(),
            riskAnalysis: getMockPurposeVersionDocument(),
            rejectionReason: "Test rejection reason",
            updatedAt: new Date(),
            firstActivationAt: new Date(),
            suspendedAt: new Date(),
          },
          {
            ...getMockPurposeVersion(),
            riskAnalysis: getMockPurposeVersionDocument(),
            rejectionReason: "Test rejection reason",
            updatedAt: new Date(),
            firstActivationAt: new Date(),
            suspendedAt: new Date(),
          },
          {
            ...getMockPurposeVersion(
              purposeVersionState.active,
              getMockPurposeVersionStamps()
            ),
            riskAnalysis: getMockPurposeVersionDocument(),
            rejectionReason: "Test rejection reason",
            updatedAt: new Date(),
            firstActivationAt: new Date(),
            suspendedAt: new Date(),
          },
        ],
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
        purposeTemplateId: generateId<PurposeTemplateId>(),
      };
      await purposeWriterService.upsertPurpose(purpose2, 1);
      await checkCompletePurpose(purpose2);

      await purposeWriterService.deletePurposeById(purpose1.id, 1);

      expect(
        await retrievePurposeSQLById(purpose1.id, readModelDB)
      ).toBeUndefined();
      expect(
        await retrievePurposeRiskAnalysisFormSQLById(purpose1.id, readModelDB)
      ).toBeUndefined();
      expect(
        await retrievePurposeRiskAnalysisAnswersSQLById(
          purpose1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrievePurposeVersionsSQLById(purpose1.id, readModelDB)
      ).toHaveLength(0);
      expect(
        await retrievePurposeVersionDocumentsSQLById(purpose1.id, readModelDB)
      ).toHaveLength(0);
      expect(
        await retrievePurposeVersionStampsSQLById(purpose1.id, readModelDB)
      ).toHaveLength(0);

      await checkCompletePurpose(purpose2);
    });
  });
});
