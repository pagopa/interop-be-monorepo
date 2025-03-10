import { describe, it, expect } from "vitest";
import { PurposeSQL } from "pagopa-interop-readmodel-models";
import {
  generateCompleteExpectedPurposeSQLObjects,
  initMockPurpose,
  purposeReadModelService,
  retrievePurposeSQLObjects,
} from "./utils.js";

describe("Purpose queries", () => {
  describe("Upsert Purpose", () => {
    it("should add a complete (*all* fields) purpose", async () => {
      const isPurposeComplete = true;
      const { purpose, purposeVersions } = initMockPurpose(isPurposeComplete);

      await purposeReadModelService.upsertPurpose(purpose);

      const {
        retrievedPurposeSQL,
        retrieveRiskAnalysisFormSQL,
        retrievedRiskAnalysisAnswersSQL,
        retrievedPurposeVersionsSQL,
        retrievedPurposeVersionDocumentsSQL,
      } = await retrievePurposeSQLObjects(purpose.data, isPurposeComplete);

      const {
        expectedPurposeSQL,
        expectedRiskAnalysisFormSQL,
        expectedRiskAnalysisAnswersSQL,
        expectedPurposeVersionsSQL,
        expectedPurposeVersionDocumentsSQL,
      } = generateCompleteExpectedPurposeSQLObjects({
        purpose,
        purposeVersions,
      });

      expect(retrievedPurposeSQL).toStrictEqual(expectedPurposeSQL);
      expect(retrieveRiskAnalysisFormSQL).toStrictEqual(
        expectedRiskAnalysisFormSQL
      );
      expect(retrievedRiskAnalysisAnswersSQL).toStrictEqual(
        expectedRiskAnalysisAnswersSQL
      );
      expect(retrievedPurposeVersionsSQL).toStrictEqual(
        expectedPurposeVersionsSQL
      );
      expect(retrievedPurposeVersionDocumentsSQL).toStrictEqual(
        expectedPurposeVersionDocumentsSQL
      );
    });

    it("should add a incomplete (*only* mandatory fields) purpose", async () => {
      const isPurposeComplete = false;
      const { purpose } = initMockPurpose(isPurposeComplete);

      await purposeReadModelService.upsertPurpose(purpose);

      const {
        retrievedPurposeSQL,
        retrieveRiskAnalysisFormSQL,
        retrievedRiskAnalysisAnswersSQL,
        retrievedPurposeVersionsSQL,
        retrievedPurposeVersionDocumentsSQL,
      } = await retrievePurposeSQLObjects(purpose.data, isPurposeComplete);

      // TODO: add in generateCompleteExpectedPurposeSQLObjects or not?
      const expectedPurposeSQL: PurposeSQL = {
        id: purpose.data.id,
        metadataVersion: purpose.metadata.version,
        eserviceId: purpose.data.eserviceId,
        consumerId: purpose.data.consumerId,
        title: purpose.data.title,
        description: purpose.data.description,
        createdAt: purpose.data.createdAt.toISOString(),
        isFreeOfCharge: purpose.data.isFreeOfCharge,
        delegationId: null,
        suspendedByConsumer: null,
        suspendedByProducer: null,
        updatedAt: null,
        freeOfChargeReason: null,
      };

      expect(retrievedPurposeSQL).toStrictEqual(expectedPurposeSQL);
      expect(retrieveRiskAnalysisFormSQL).toBeUndefined();
      expect(retrievedRiskAnalysisAnswersSQL).toBeUndefined();
      expect(retrievedPurposeVersionsSQL).toBeUndefined();
      expect(retrievedPurposeVersionDocumentsSQL).toBeUndefined();
    });

    it("should update a complete (*all* fields) purpose", async () => {
      const isPurposeComplete = true;
      const { purposeBeforeUpdate, purpose, purposeVersions } =
        initMockPurpose(isPurposeComplete);

      await purposeReadModelService.upsertPurpose(purposeBeforeUpdate);
      await purposeReadModelService.upsertPurpose(purpose);

      const {
        retrievedPurposeSQL,
        retrieveRiskAnalysisFormSQL,
        retrievedRiskAnalysisAnswersSQL,
        retrievedPurposeVersionsSQL,
        retrievedPurposeVersionDocumentsSQL,
      } = await retrievePurposeSQLObjects(purpose.data, isPurposeComplete);

      const {
        expectedPurposeSQL,
        expectedRiskAnalysisFormSQL,
        expectedRiskAnalysisAnswersSQL,
        expectedPurposeVersionsSQL,
        expectedPurposeVersionDocumentsSQL,
      } = generateCompleteExpectedPurposeSQLObjects({
        purpose,
        purposeVersions,
      });

      expect(retrievedPurposeSQL).toStrictEqual(expectedPurposeSQL);
      expect(retrieveRiskAnalysisFormSQL).toStrictEqual(
        expectedRiskAnalysisFormSQL
      );
      expect(retrievedRiskAnalysisAnswersSQL).toStrictEqual(
        expectedRiskAnalysisAnswersSQL
      );
      expect(retrievedPurposeVersionsSQL).toStrictEqual(
        expectedPurposeVersionsSQL
      );
      expect(retrievedPurposeVersionDocumentsSQL).toStrictEqual(
        expectedPurposeVersionDocumentsSQL
      );
    });
  });
});
