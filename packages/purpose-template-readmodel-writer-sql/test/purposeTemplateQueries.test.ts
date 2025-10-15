/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getMockPurposeTemplate } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { aggregatePurposeTemplate } from "pagopa-interop-readmodel";
import {
  EServiceDescriptorPurposeTemplate,
  generateId,
} from "pagopa-interop-models";
import {
  checkCompletePurposeTemplate,
  getCompleteMockPurposeTemplate,
  purposeTemplateReadModelService,
  purposeTemplateWriterService,
  readModelDB,
  retrievePurposeTemplateRiskAnalysisAnswersAnnotationsDocumentsSQLById,
  retrievePurposeTemplateRiskAnalysisAnswersAnnotationsSQLById,
  retrievePurposeTemplateRiskAnalysisAnswersSQLById,
  retrievePurposeTemplateRiskAnalysisFormSQLById,
  retrievePurposeTemplateSQLById,
} from "./utils.js";

describe("Purpose template queries", () => {
  describe("Upsert Purpose Template", () => {
    it("should add a complete (*all* fields) purpose template", async () => {
      const metadataVersion = 1;

      const purposeTemplate = getCompleteMockPurposeTemplate();
      const purposeTemplateEServiceDescriptor: EServiceDescriptorPurposeTemplate =
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: generateId(),
          descriptorId: generateId(),
          createdAt: new Date(),
        };

      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        metadataVersion
      );
      await purposeTemplateWriterService.upsertPurposeTemplateEServiceDescriptor(
        purposeTemplateEServiceDescriptor,
        metadataVersion
      );

      const {
        purposeTemplateSQL,
        riskAnalysisFormTemplateSQL,
        riskAnalysisTemplateAnswersSQL,
        riskAnalysisTemplateAnswersAnnotationsSQL,
        riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
      } = await checkCompletePurposeTemplate(purposeTemplate);

      const retrievedPurposeTemplate = aggregatePurposeTemplate({
        purposeTemplateSQL,
        riskAnalysisFormTemplateSQL,
        riskAnalysisTemplateAnswersSQL,
        riskAnalysisTemplateAnswersAnnotationsSQL,
        riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
      });

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: purposeTemplate,
        metadata: { version: metadataVersion },
      });
      expect(
        await purposeTemplateReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateId(
          purposeTemplate.id
        )
      ).toEqual([purposeTemplateEServiceDescriptor]);
    });

    it("should add a incomplete (*only* mandatory fields) purpose template", async () => {
      const purposeTemplate = getMockPurposeTemplate();

      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        1
      );

      const retrievedPurposeTemplateSQL = await retrievePurposeTemplateSQLById(
        readModelDB,
        purposeTemplate.id
      );
      const retrievedRiskAnalysisFormTemplateSQL =
        await retrievePurposeTemplateRiskAnalysisFormSQLById(
          readModelDB,
          purposeTemplate.id
        );
      const retrievedRiskAnalysisTemplateAnswersSQL =
        await retrievePurposeTemplateRiskAnalysisAnswersSQLById(
          readModelDB,
          purposeTemplate.id
        );
      const retrievedRiskAnalysisTemplateAnswersAnnotationsSQL =
        await retrievePurposeTemplateRiskAnalysisAnswersAnnotationsSQLById(
          readModelDB,
          purposeTemplate.id
        );
      const retrievedRiskAnalysisTemplateAnswersAnnotationsDocumentsSQL =
        await retrievePurposeTemplateRiskAnalysisAnswersAnnotationsDocumentsSQLById(
          readModelDB,
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplateSQL).toBeDefined();
      expect(retrievedRiskAnalysisFormTemplateSQL).toBeUndefined();
      expect(retrievedRiskAnalysisTemplateAnswersSQL).toHaveLength(0);
      expect(retrievedRiskAnalysisTemplateAnswersAnnotationsSQL).toHaveLength(
        0
      );
      expect(
        retrievedRiskAnalysisTemplateAnswersAnnotationsDocumentsSQL
      ).toHaveLength(0);

      const retrievedPurposeTemplate = aggregatePurposeTemplate({
        purposeTemplateSQL: retrievedPurposeTemplateSQL!,
        riskAnalysisFormTemplateSQL: retrievedRiskAnalysisFormTemplateSQL,
        riskAnalysisTemplateAnswersSQL: retrievedRiskAnalysisTemplateAnswersSQL,
        riskAnalysisTemplateAnswersAnnotationsSQL:
          retrievedRiskAnalysisTemplateAnswersAnnotationsSQL,
        riskAnalysisTemplateAnswersAnnotationsDocumentsSQL:
          retrievedRiskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
      });

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: purposeTemplate,
        metadata: { version: 1 },
      });
    });

    it("should update a complete (*all* fields) purpose template", async () => {
      const purposeTemplate = getCompleteMockPurposeTemplate();

      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        1
      );
      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        2
      );

      const {
        purposeTemplateSQL,
        riskAnalysisFormTemplateSQL,
        riskAnalysisTemplateAnswersSQL,
        riskAnalysisTemplateAnswersAnnotationsSQL,
        riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
      } = await checkCompletePurposeTemplate(purposeTemplate);

      const retrievedPurposeTemplate = aggregatePurposeTemplate({
        purposeTemplateSQL,
        riskAnalysisFormTemplateSQL,
        riskAnalysisTemplateAnswersSQL,
        riskAnalysisTemplateAnswersAnnotationsSQL,
        riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
      });

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: purposeTemplate,
        metadata: { version: 2 },
      });
    });
  });

  describe("Delete a Purpose Template", () => {
    it("should delete a purpose template by id", async () => {
      const purposeTemplate1 = getCompleteMockPurposeTemplate();
      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate1,
        1
      );

      const purposeTemplate2 = getCompleteMockPurposeTemplate();
      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate2,
        1
      );

      await purposeTemplateWriterService.deletePurposeTemplateById(
        purposeTemplate1.id,
        2
      );

      expect(
        await retrievePurposeTemplateSQLById(readModelDB, purposeTemplate1.id)
      ).toBeUndefined();
      expect(
        await retrievePurposeTemplateRiskAnalysisFormSQLById(
          readModelDB,
          purposeTemplate1.id
        )
      ).toBeUndefined();
      expect(
        await retrievePurposeTemplateRiskAnalysisAnswersSQLById(
          readModelDB,
          purposeTemplate1.id
        )
      ).toHaveLength(0);
      expect(
        await retrievePurposeTemplateRiskAnalysisAnswersAnnotationsSQLById(
          readModelDB,
          purposeTemplate1.id
        )
      ).toHaveLength(0);
      expect(
        await retrievePurposeTemplateRiskAnalysisAnswersAnnotationsDocumentsSQLById(
          readModelDB,
          purposeTemplate1.id
        )
      ).toHaveLength(0);

      await checkCompletePurposeTemplate(purposeTemplate2);
    });
  });
});
