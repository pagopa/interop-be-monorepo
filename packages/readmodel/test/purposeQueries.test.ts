import { describe, it, expect } from "vitest";
import { PurposeSQL } from "pagopa-interop-readmodel-models";
import { generateId } from "pagopa-interop-models";
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

      await purposeReadModelService.upsertPurpose(
        purpose.data,
        purpose.metadata.version
      );

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

      await purposeReadModelService.upsertPurpose(
        purpose.data,
        purpose.metadata.version
      );

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

      await purposeReadModelService.upsertPurpose(
        purposeBeforeUpdate.data,
        purposeBeforeUpdate.metadata.version
      );
      await purposeReadModelService.upsertPurpose(
        purpose.data,
        purpose.metadata.version
      );

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

  describe("Get a Purpose", async () => {
    it("should get a purpose from by purpose id", async () => {
      const isPurposeComplete = true;
      const { purpose } = initMockPurpose(isPurposeComplete);
      await purposeReadModelService.upsertPurpose(
        purpose.data,
        purpose.metadata.version
      );

      const retrievedPurpose = await purposeReadModelService.getPurposeById(
        purpose.data.id
      );

      expect(retrievedPurpose).toStrictEqual(purpose);
    });

    it("should *not* get a purpose by purpose id", async () => {
      const retrievedPurpose = await purposeReadModelService.getPurposeById(
        generateId()
      );

      expect(retrievedPurpose).toBeUndefined();
    });
  });

  describe("Get all Purposes", () => {
    it("should get all purposes", async () => {
      const isPurposeComplete = true;
      const { purpose: purpose1 } = initMockPurpose(isPurposeComplete);
      const { purpose: purpose2 } = initMockPurpose(isPurposeComplete);

      await purposeReadModelService.upsertPurpose(
        purpose1.data,
        purpose1.metadata.version
      );
      await purposeReadModelService.upsertPurpose(
        purpose2.data,
        purpose2.metadata.version
      );

      const retrievedPurposes = await purposeReadModelService.getAllPurposes();

      expect(retrievedPurposes).toHaveLength(2);
      // TODO: fix this test
      // expect(retrievedPurposes).toStrictEqual(
      //   expect.arrayContaining([purpose1, purpose2])
      // );
    });

    it("should *not* get any purposes", async () => {
      const retrievedPurposes = await purposeReadModelService.getAllPurposes();

      expect(retrievedPurposes).toStrictEqual([]);
    });
  });

  describe("Delete a Purpose", () => {
    it("should delete a purpose by purpose id", async () => {
      const isPurposeComplete = true;
      const { purpose } = initMockPurpose(isPurposeComplete);
      await purposeReadModelService.upsertPurpose(
        purpose.data,
        purpose.metadata.version
      );

      await purposeReadModelService.deletePurposeById(
        purpose.data.id,
        purpose.metadata.version + 1
      );

      const retrievedPurpose = await purposeReadModelService.getPurposeById(
        purpose.data.id
      );

      expect(retrievedPurpose).toBeUndefined();
    });
  });
});
