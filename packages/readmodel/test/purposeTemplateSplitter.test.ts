/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockPurposeTemplate,
  getMockRiskAnalysisFormTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockRiskAnalysisTemplateAnswerAnnotation,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplate,
  riskAnalysisAnswerKind,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  PurposeTemplateEServiceDescriptorVersionSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationSQL,
  PurposeTemplateRiskAnalysisAnswerSQL,
  PurposeTemplateRiskAnalysisFormSQL,
  PurposeTemplateSQL,
} from "pagopa-interop-readmodel-models";
import { splitPurposeTemplateIntoObjectsSQL } from "../src/purpose-template/splitters.js";

describe("Purpose Template splitter", () => {
  it("should convert a complete purpose template into purpose template SQL objects", () => {
    const metadataVersion = 1;
    const incompleteRiskAnalysisFormTemplate = getMockRiskAnalysisFormTemplate(
      tenantKind.PA
    );
    const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
      ...incompleteRiskAnalysisFormTemplate,
      singleAnswers: incompleteRiskAnalysisFormTemplate.singleAnswers.map(
        (a): RiskAnalysisTemplateSingleAnswer => ({
          ...a,
          annotation: {
            ...getMockRiskAnalysisTemplateAnswerAnnotation(),
            docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
          },
          assistiveText: "Single answer assistive text",
          suggestedValues: ["a", "b"],
        })
      ),
      multiAnswers: incompleteRiskAnalysisFormTemplate.multiAnswers.map(
        (a): RiskAnalysisTemplateMultiAnswer => ({
          ...a,
          annotation: {
            ...getMockRiskAnalysisTemplateAnswerAnnotation(),
            docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
          },
          assistiveText: "Multi answer assistive text",
        })
      ),
    };
    const purposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      eservicesVersions: [
        {
          eserviceId: generateId(),
          descriptorId: generateId(),
        },
        {
          eserviceId: generateId(),
          descriptorId: generateId(),
        },
      ],
      updatedAt: new Date(),
      purposeRiskAnalysisForm: riskAnalysisFormTemplate,
      purposeFreeOfChargeReason: "Free of charge reason",
      purposeDailyCalls: 100,
    };

    const {
      purposeTemplateSQL,
      eserviceDescriptorVersionsSQL,
      riskAnalysisFormTemplateSQL,
      riskAnalysisTemplateAnswersSQL,
      riskAnalysisTemplateAnswerAnnotationsSQL,
      riskAnalysisTemplateAnswerAnnotationDocumentsSQL,
    } = splitPurposeTemplateIntoObjectsSQL(purposeTemplate, metadataVersion);

    const expectedPurposeTemplateSQL: PurposeTemplateSQL = {
      id: purposeTemplate.id,
      metadataVersion,
      targetDescription: purposeTemplate.targetDescription,
      targetTenantKind: purposeTemplate.targetTenantKind,
      creatorId: purposeTemplate.creatorId,
      state: purposeTemplate.state,
      createdAt: purposeTemplate.createdAt.toISOString(),
      updatedAt: purposeTemplate.updatedAt!.toISOString(),
      purposeTitle: purposeTemplate.purposeTitle,
      purposeDescription: purposeTemplate.purposeDescription,
      purposeIsFreeOfCharge: purposeTemplate.purposeIsFreeOfCharge,
      purposeFreeOfChargeReason: purposeTemplate.purposeFreeOfChargeReason!,
      purposeDailyCalls: purposeTemplate.purposeDailyCalls!,
    };

    const expectedEServiceDescriptorVersionsSQL: PurposeTemplateEServiceDescriptorVersionSQL[] =
      [
        {
          metadataVersion,
          purposeTemplateId: purposeTemplate.id,
          eserviceId: purposeTemplate.eservicesVersions[0].eserviceId,
          descriptorId: purposeTemplate.eservicesVersions[0].descriptorId,
        },
        {
          metadataVersion,
          purposeTemplateId: purposeTemplate.id,
          eserviceId: purposeTemplate.eservicesVersions[1].eserviceId,
          descriptorId: purposeTemplate.eservicesVersions[1].descriptorId,
        },
      ];

    const expectedRiskAnalysisFormTemplateSQL: PurposeTemplateRiskAnalysisFormSQL =
      {
        id: riskAnalysisFormTemplate.id,
        purposeTemplateId: purposeTemplate.id,
        metadataVersion,
        version: riskAnalysisFormTemplate.version,
      };

    const {
      expectedRiskAnalysisTemplateSingleAnswersSQL,
      expectedRiskAnalysisTemplateSingleAnswersAnnotationsSQL,
      expectedRiskAnalysisTemplateSingleAnswersAnnotationsDocumentsSQL,
    } = riskAnalysisFormTemplate.singleAnswers.reduce(
      (acc, singleAnswer) => {
        const singleAnswerAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[] =
          singleAnswer.annotation!.docs.map((a) => ({
            id: a.id,
            purposeTemplateId: purposeTemplate.id,
            metadataVersion,
            annotationId: singleAnswer.annotation!.id,
            name: a.name,
            contentType: a.contentType,
            path: a.path,
            createdAt: a.createdAt.toISOString(),
          }));
        return {
          expectedRiskAnalysisTemplateSingleAnswersSQL: [
            ...acc.expectedRiskAnalysisTemplateSingleAnswersSQL,
            {
              id: singleAnswer.id,
              purposeTemplateId: purposeTemplate.id,
              metadataVersion,
              riskAnalysisFormId: riskAnalysisFormTemplate.id,
              kind: riskAnalysisAnswerKind.single,
              key: singleAnswer.key,
              value: [singleAnswer.value!],
              editable: singleAnswer.editable,
              assistiveText: singleAnswer.assistiveText!,
              suggestedValues: singleAnswer.suggestedValues,
            } satisfies PurposeTemplateRiskAnalysisAnswerSQL,
          ],
          expectedRiskAnalysisTemplateSingleAnswersAnnotationsSQL: [
            ...acc.expectedRiskAnalysisTemplateSingleAnswersAnnotationsSQL,
            {
              id: singleAnswer.annotation!.id,
              purposeTemplateId: purposeTemplate.id,
              metadataVersion,
              answerId: singleAnswer.id,
              text: singleAnswer.annotation!.text!,
            } satisfies PurposeTemplateRiskAnalysisAnswerAnnotationSQL,
          ],
          expectedRiskAnalysisTemplateSingleAnswersAnnotationsDocumentsSQL: [
            ...acc.expectedRiskAnalysisTemplateSingleAnswersAnnotationsDocumentsSQL,
            ...singleAnswerAnnotationsDocumentsSQL,
          ],
        };
      },
      {
        expectedRiskAnalysisTemplateSingleAnswersSQL:
          new Array<PurposeTemplateRiskAnalysisAnswerSQL>(),
        expectedRiskAnalysisTemplateSingleAnswersAnnotationsSQL:
          new Array<PurposeTemplateRiskAnalysisAnswerAnnotationSQL>(),
        expectedRiskAnalysisTemplateSingleAnswersAnnotationsDocumentsSQL:
          new Array<PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL>(),
      }
    );

    const {
      expectedRiskAnalysisTemplateMultiAnswersSQL,
      expectedRiskAnalysisTemplateMultiAnswersAnnotationsSQL,
      expectedRiskAnalysisTemplateMultiAnswersAnnotationsDocumentsSQL,
    } = riskAnalysisFormTemplate.multiAnswers.reduce(
      (acc, multiAnswer) => {
        const multiAnswerAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[] =
          multiAnswer.annotation!.docs.map((a) => ({
            id: a.id,
            purposeTemplateId: purposeTemplate.id,
            metadataVersion,
            annotationId: multiAnswer.annotation!.id,
            name: a.name,
            contentType: a.contentType,
            path: a.path,
            createdAt: a.createdAt.toISOString(),
          }));
        return {
          expectedRiskAnalysisTemplateMultiAnswersSQL: [
            ...acc.expectedRiskAnalysisTemplateMultiAnswersSQL,
            {
              id: multiAnswer.id,
              purposeTemplateId: purposeTemplate.id,
              metadataVersion,
              riskAnalysisFormId: riskAnalysisFormTemplate.id,
              kind: riskAnalysisAnswerKind.multi,
              key: multiAnswer.key,
              value: multiAnswer.values,
              editable: multiAnswer.editable,
              assistiveText: multiAnswer.assistiveText!,
              suggestedValues: null,
            } satisfies PurposeTemplateRiskAnalysisAnswerSQL,
          ],
          expectedRiskAnalysisTemplateMultiAnswersAnnotationsSQL: [
            ...acc.expectedRiskAnalysisTemplateMultiAnswersAnnotationsSQL,
            {
              id: multiAnswer.annotation!.id,
              purposeTemplateId: purposeTemplate.id,
              metadataVersion,
              answerId: multiAnswer.id,
              text: multiAnswer.annotation!.text!,
            } satisfies PurposeTemplateRiskAnalysisAnswerAnnotationSQL,
          ],
          expectedRiskAnalysisTemplateMultiAnswersAnnotationsDocumentsSQL: [
            ...acc.expectedRiskAnalysisTemplateMultiAnswersAnnotationsDocumentsSQL,
            ...multiAnswerAnnotationsDocumentsSQL,
          ],
        };
      },
      {
        expectedRiskAnalysisTemplateMultiAnswersSQL:
          new Array<PurposeTemplateRiskAnalysisAnswerSQL>(),
        expectedRiskAnalysisTemplateMultiAnswersAnnotationsSQL:
          new Array<PurposeTemplateRiskAnalysisAnswerAnnotationSQL>(),
        expectedRiskAnalysisTemplateMultiAnswersAnnotationsDocumentsSQL:
          new Array<PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL>(),
      }
    );

    expect(purposeTemplateSQL).toStrictEqual(expectedPurposeTemplateSQL);
    expect(eserviceDescriptorVersionsSQL).toStrictEqual(
      expect.arrayContaining(expectedEServiceDescriptorVersionsSQL)
    );
    expect(riskAnalysisFormTemplateSQL).toStrictEqual(
      expectedRiskAnalysisFormTemplateSQL
    );
    expect(riskAnalysisTemplateAnswersSQL).toStrictEqual(
      expect.arrayContaining([
        ...expectedRiskAnalysisTemplateSingleAnswersSQL,
        ...expectedRiskAnalysisTemplateMultiAnswersSQL,
      ])
    );
    expect(riskAnalysisTemplateAnswerAnnotationsSQL).toStrictEqual(
      expect.arrayContaining([
        ...expectedRiskAnalysisTemplateSingleAnswersAnnotationsSQL,
        ...expectedRiskAnalysisTemplateMultiAnswersAnnotationsSQL,
      ])
    );
    expect(riskAnalysisTemplateAnswerAnnotationDocumentsSQL).toStrictEqual(
      expect.arrayContaining([
        ...expectedRiskAnalysisTemplateSingleAnswersAnnotationsDocumentsSQL,
        ...expectedRiskAnalysisTemplateMultiAnswersAnnotationsDocumentsSQL,
      ])
    );
  });

  it("should convert an incomplete purpose template into purpose template SQL objects (undefined -> null)", () => {
    const metadataVersion = 1;
    const riskAnalysisFormTemplate = getMockRiskAnalysisFormTemplate(
      tenantKind.PA
    );
    const purposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      eservicesVersions: [],
      purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    };

    const {
      purposeTemplateSQL,
      eserviceDescriptorVersionsSQL,
      riskAnalysisFormTemplateSQL,
      riskAnalysisTemplateAnswersSQL,
      riskAnalysisTemplateAnswerAnnotationsSQL,
      riskAnalysisTemplateAnswerAnnotationDocumentsSQL,
    } = splitPurposeTemplateIntoObjectsSQL(purposeTemplate, metadataVersion);

    const expectedPurposeTemplateSQL: PurposeTemplateSQL = {
      id: purposeTemplate.id,
      metadataVersion,
      targetDescription: purposeTemplate.targetDescription,
      targetTenantKind: purposeTemplate.targetTenantKind,
      creatorId: purposeTemplate.creatorId,
      state: purposeTemplate.state,
      createdAt: purposeTemplate.createdAt.toISOString(),
      updatedAt: null,
      purposeTitle: purposeTemplate.purposeTitle,
      purposeDescription: purposeTemplate.purposeDescription,
      purposeIsFreeOfCharge: purposeTemplate.purposeIsFreeOfCharge,
      purposeFreeOfChargeReason: null,
      purposeDailyCalls: null,
    };

    const expectedRiskAnalysisFormTemplateSQL: PurposeTemplateRiskAnalysisFormSQL =
      {
        id: riskAnalysisFormTemplate.id,
        purposeTemplateId: purposeTemplate.id,
        metadataVersion,
        version: riskAnalysisFormTemplate.version,
      };

    const expectedRiskAnalysisTemplateSingleAnswersSQL =
      riskAnalysisFormTemplate.singleAnswers.map(
        (singleAnswer): PurposeTemplateRiskAnalysisAnswerSQL => ({
          id: singleAnswer.id,
          purposeTemplateId: purposeTemplate.id,
          metadataVersion,
          riskAnalysisFormId: riskAnalysisFormTemplate.id,
          kind: riskAnalysisAnswerKind.single,
          key: singleAnswer.key,
          value: [singleAnswer.value!],
          editable: singleAnswer.editable,
          assistiveText: null,
          suggestedValues: singleAnswer.suggestedValues,
        })
      );

    const expectedRiskAnalysisTemplateMultiAnswersSQL =
      riskAnalysisFormTemplate.multiAnswers.map((multiAnswer) => ({
        id: multiAnswer.id,
        purposeTemplateId: purposeTemplate.id,
        metadataVersion,
        riskAnalysisFormId: riskAnalysisFormTemplate.id,
        kind: riskAnalysisAnswerKind.multi,
        key: multiAnswer.key,
        value: multiAnswer.values,
        editable: multiAnswer.editable,
        assistiveText: null,
        suggestedValues: null,
      }));

    expect(purposeTemplateSQL).toStrictEqual(expectedPurposeTemplateSQL);
    expect(eserviceDescriptorVersionsSQL).toHaveLength(0);
    expect(riskAnalysisFormTemplateSQL).toStrictEqual(
      expectedRiskAnalysisFormTemplateSQL
    );
    expect(riskAnalysisTemplateAnswersSQL).toStrictEqual(
      expect.arrayContaining([
        ...expectedRiskAnalysisTemplateSingleAnswersSQL,
        ...expectedRiskAnalysisTemplateMultiAnswersSQL,
      ])
    );
    expect(riskAnalysisTemplateAnswerAnnotationsSQL).toHaveLength(0);
    expect(riskAnalysisTemplateAnswerAnnotationDocumentsSQL).toHaveLength(0);
  });
});
