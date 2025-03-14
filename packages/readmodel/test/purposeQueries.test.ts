/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import {
  DelegationId,
  generateId,
  Purpose,
  PurposeVersion,
  purposeVersionState,
  RiskAnalysisId,
  tenantKind,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import { aggregatePurpose } from "../src/purpose/aggregators.js";
import { readModelDB } from "./utils.js";
import {
  purposeReadModelService,
  retrievePurposeRiskAnalysisAnswersSQLById,
  retrievePurposeRiskAnalysisFormById,
  retrievePurposeSQLById,
  retrievePurposeVersionDocumentSQLById,
  retrievePurposeVersionsSQLById,
} from "./purposeUtils.js";

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
      const purposeVersions = [purposeVersion1, purposeVersion2];

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm: {
          ...getMockValidRiskAnalysisForm(tenantKind.PA),
          riskAnalysisId: generateId<RiskAnalysisId>(),
        },
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
      };

      await purposeReadModelService.upsertPurpose(purpose, 1);

      const retrievedPurposeSQL = await retrievePurposeSQLById(
        purpose.id,
        readModelDB
      );
      const retrievedRiskAnalysisFormSQL =
        await retrievePurposeRiskAnalysisFormById(purpose.id, readModelDB);
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
        await retrievePurposeVersionDocumentSQLById(purpose.id, readModelDB);

      expect(retrievedPurposeSQL).toBeDefined();
      expect(retrievedRiskAnalysisFormSQL).toBeDefined();
      expect(retrievedRiskAnalysisAnswersSQL).toHaveLength(
        purpose.riskAnalysisForm!.multiAnswers.length +
          purpose.riskAnalysisForm!.singleAnswers.length
      );
      expect(retrievedPurposeVersionsSQL).toHaveLength(purposeVersions.length);
      expect(retrievedPurposeVersionDocumentSQL).toHaveLength(
        purposeVersions.length
      );

      const retrievedPurpose = aggregatePurpose({
        purposeSQL: retrievedPurposeSQL,
        riskAnalysisFormSQL: retrievedRiskAnalysisFormSQL,
        riskAnalysisAnswersSQL: retrievedRiskAnalysisAnswersSQL,
        versionsSQL: retrievedPurposeVersionsSQL,
        versionDocumentsSQL: retrievedPurposeVersionDocumentSQL,
      });

      expect(retrievedPurpose).toStrictEqual({
        data: purpose,
        metadata: { version: 1 },
      });
    });

    it("should add a incomplete (*only* mandatory fields) purpose", async () => {
      const purpose = getMockPurpose();

      await purposeReadModelService.upsertPurpose(purpose, 1);

      const retrievedPurposeSQL = await retrievePurposeSQLById(
        purpose.id,
        readModelDB
      );
      const retrievedRiskAnalysisFormSQL =
        await retrievePurposeRiskAnalysisFormById(purpose.id, readModelDB);
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
        await retrievePurposeVersionDocumentSQLById(purpose.id, readModelDB);

      expect(retrievedPurposeSQL).toBeDefined();
      expect(retrievedRiskAnalysisFormSQL).toBeUndefined();
      expect(retrievedRiskAnalysisAnswersSQL).toHaveLength(0);
      expect(retrievedPurposeVersionsSQL).toHaveLength(0);
      expect(retrievedPurposeVersionDocumentSQL).toHaveLength(0);

      const retrievedPurpose = aggregatePurpose({
        purposeSQL: retrievedPurposeSQL,
        riskAnalysisFormSQL: retrievedRiskAnalysisFormSQL,
        riskAnalysisAnswersSQL: retrievedRiskAnalysisAnswersSQL,
        versionsSQL: retrievedPurposeVersionsSQL,
        versionDocumentsSQL: retrievedPurposeVersionDocumentSQL,
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
      const purposeVersions = [purposeVersion1, purposeVersion2];

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm: {
          ...getMockValidRiskAnalysisForm(tenantKind.PA),
          riskAnalysisId: generateId<RiskAnalysisId>(),
        },
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
      };

      await purposeReadModelService.upsertPurpose(purpose, 1);
      await purposeReadModelService.upsertPurpose(purpose, 2);

      const retrievedPurposeSQL = await retrievePurposeSQLById(
        purpose.id,
        readModelDB
      );
      const retrievedRiskAnalysisFormSQL =
        await retrievePurposeRiskAnalysisFormById(purpose.id, readModelDB);
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
        await retrievePurposeVersionDocumentSQLById(purpose.id, readModelDB);

      expect(retrievedPurposeSQL).toBeDefined();
      expect(retrievedRiskAnalysisFormSQL).toBeDefined();
      expect(retrievedRiskAnalysisAnswersSQL).toHaveLength(
        purpose.riskAnalysisForm!.multiAnswers.length +
          purpose.riskAnalysisForm!.singleAnswers.length
      );
      expect(retrievedPurposeVersionsSQL).toHaveLength(purposeVersions.length);
      expect(retrievedPurposeVersionDocumentSQL).toHaveLength(
        purposeVersions.length
      );

      const retrievedPurpose = aggregatePurpose({
        purposeSQL: retrievedPurposeSQL,
        riskAnalysisFormSQL: retrievedRiskAnalysisFormSQL,
        riskAnalysisAnswersSQL: retrievedRiskAnalysisAnswersSQL,
        versionsSQL: retrievedPurposeVersionsSQL,
        versionDocumentsSQL: retrievedPurposeVersionDocumentSQL,
      });

      expect(retrievedPurpose).toStrictEqual({
        data: purpose,
        metadata: { version: 2 },
      });
    });
  });

  describe("Get a Purpose", async () => {
    it("should get a purpose by id if present", async () => {
      const purpose = getMockPurpose([getMockPurposeVersion()]);
      await purposeReadModelService.upsertPurpose(purpose, 1);

      const retrievedPurpose = await purposeReadModelService.getPurposeById(
        purpose.id
      );

      expect(retrievedPurpose).toStrictEqual({
        data: purpose,
        metadata: { version: 1 },
      });
    });

    it("should *not* get a purpose by id if not present", async () => {
      const retrievedPurpose = await purposeReadModelService.getPurposeById(
        generateId()
      );

      expect(retrievedPurpose).toBeUndefined();
    });
  });

  describe("Delete a Purpose", () => {
    it("should delete a purpose by id", async () => {
      const checkCompletePurpose = async (purpose: Purpose): Promise<void> => {
        expect(
          await retrievePurposeSQLById(purpose.id, readModelDB)
        ).toBeDefined();
        expect(
          await retrievePurposeRiskAnalysisFormById(purpose.id, readModelDB)
        ).toBeDefined();
        expect(
          await retrievePurposeRiskAnalysisAnswersSQLById(
            purpose.id,
            readModelDB
          )
        ).toHaveLength(
          purpose.riskAnalysisForm!.multiAnswers.length +
            purpose.riskAnalysisForm!.singleAnswers.length
        );
        expect(
          await retrievePurposeVersionsSQLById(purpose.id, readModelDB)
        ).toHaveLength(purpose.versions.length);
        expect(
          await retrievePurposeVersionDocumentSQLById(purpose.id, readModelDB)
        ).toHaveLength(purpose.versions.length);
      };

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
        ],
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm: {
          ...getMockValidRiskAnalysisForm(tenantKind.PA),
          riskAnalysisId: generateId<RiskAnalysisId>(),
        },
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
      };
      await purposeReadModelService.upsertPurpose(purpose1, 1);
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
        ],
        delegationId: generateId<DelegationId>(),
        suspendedByConsumer: false,
        suspendedByProducer: false,
        riskAnalysisForm: {
          ...getMockValidRiskAnalysisForm(tenantKind.PA),
          riskAnalysisId: generateId<RiskAnalysisId>(),
        },
        updatedAt: new Date(),
        freeOfChargeReason: "Test free of charge reason",
      };
      await purposeReadModelService.upsertPurpose(purpose2, 1);
      await checkCompletePurpose(purpose2);

      await purposeReadModelService.deletePurposeById(purpose1.id, 1);

      expect(
        await retrievePurposeSQLById(purpose1.id, readModelDB)
      ).toBeUndefined();
      expect(
        await retrievePurposeRiskAnalysisFormById(purpose1.id, readModelDB)
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
        await retrievePurposeVersionDocumentSQLById(purpose1.id, readModelDB)
      ).toHaveLength(0);

      await checkCompletePurpose(purpose2);
    });
  });
});
