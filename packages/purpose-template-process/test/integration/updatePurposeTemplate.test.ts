/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockRiskAnalysisTemplateAnswerAnnotationWithDocs,
  getMockTenant,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplate,
  PurposeTemplateAddedV2,
  purposeTemplateState,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
  RiskAnalysisTemplateSingleAnswer,
  Tenant,
  TenantId,
  tenantKind,
  toPurposeTemplateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "../../src/config/config.js";
import {
  missingFreeOfChargeReason,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import * as validators from "../../src/services/validators.js";
import {
  addOnePurposeTemplate,
  addOneTenant,
  fileManager,
  PurposeTemplateSeedApiBuilder,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
  uploadDocument,
} from "../integrationUtils.js";
import {
  buildRiskAnalysisFormTemplateSeed,
  getMockPurposeTemplateSeed,
} from "../mockUtils.js";

describe("updatePurposeTemplate", () => {
  const mockDate = new Date();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  const riskAnalisysPAVersion = "3.0";
  const riskAnalisysPrivateVersion = "2.0";
  const creatorId = generateId<TenantId>();
  const creator: Tenant = getMockTenant(creatorId);

  const mockValidRiskAnalysisTemplateForm =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);

  const purposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed =
    getMockPurposeTemplateSeed(
      buildRiskAnalysisFormTemplateSeed(mockValidRiskAnalysisTemplateForm)
    );

  const existingPurposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(creatorId),
    purposeRiskAnalysisForm: mockValidRiskAnalysisTemplateForm,
  };

  it.skip.each([
    { kind: tenantKind.PA, riskAnalysisVersion: riskAnalisysPAVersion },
    {
      kind: tenantKind.PRIVATE,
      riskAnalysisVersion: riskAnalisysPrivateVersion,
    },
  ])(
    "should successfully update a purpose template in draft state with valid data and targetTenantKind %s",
    async ({ kind: tenantKind, riskAnalysisVersion }) => {
      const spy = vi.spyOn(
        validators,
        "validateAndTransformRiskAnalysisTemplate"
      );

      const mockValidRiskAnalysisTemplateForm =
        getMockValidRiskAnalysisFormTemplate(tenantKind);

      const riskAnalysisFormTemplateSeed = {
        ...buildRiskAnalysisFormTemplateSeed(mockValidRiskAnalysisTemplateForm),
        version: riskAnalysisVersion,
      };

      const updatedAnswers = Object.fromEntries([
        ...Object.entries(riskAnalysisFormTemplateSeed.answers)
          .map(([key, answer]) =>
            key === "purpose"
              ? [
                  "purpose",
                  {
                    editable: false,
                    annotation: undefined,
                    // change "purpose" value to OTHER to enable "otherPurpose"
                    values: ["OTHER"],
                    suggestedValues: [],
                  },
                ]
              : [key, answer]
          )
          // "institutionalPurpose" not allow if "purpose" = OTHER
          .filter(([key]) => key !== "institutionalPurpose"),
        [
          // add new value to answer "otherPurpose"
          "otherPurpose",
          {
            editable: false,
            annotation: undefined,
            values: ["Updated Answer value"],
            suggestedValues: [],
          },
        ],
      ]);

      const validPurposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed = {
        ...getMockPurposeTemplateSeed(),
        targetTenantKind: tenantKind,
        purposeTitle: "Updated Purpose Template title", // updated field
        purposeRiskAnalysisForm: {
          ...riskAnalysisFormTemplateSeed,
          answers: updatedAnswers,
        },
      };

      const existingPurposeTemplate: PurposeTemplate = {
        ...getMockPurposeTemplate(creatorId),
        targetTenantKind: tenantKind,
        purposeRiskAnalysisForm: {
          ...mockValidRiskAnalysisTemplateForm,
          version: riskAnalysisVersion,
        },
      };

      await addOnePurposeTemplate(existingPurposeTemplate);
      await addOneTenant(creator);

      const updatedPurposeTemplateResponse =
        await purposeTemplateService.updatePurposeTemplate(
          existingPurposeTemplate.id,
          validPurposeTemplateSeed,
          getMockContext({
            authData: getMockAuthData(creatorId),
          })
        );

      const expectedPurposeTemplate: PurposeTemplate = {
        id: unsafeBrandId(updatedPurposeTemplateResponse.data.id),
        createdAt: mockDate,
        targetDescription: validPurposeTemplateSeed.targetDescription,
        targetTenantKind: validPurposeTemplateSeed.targetTenantKind,
        creatorId: unsafeBrandId(existingPurposeTemplate.creatorId),
        state: purposeTemplateState.draft,
        purposeTitle: validPurposeTemplateSeed.purposeTitle,
        purposeDescription: validPurposeTemplateSeed.purposeDescription,
        purposeDailyCalls: validPurposeTemplateSeed.purposeDailyCalls,
        purposeIsFreeOfCharge: validPurposeTemplateSeed.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason:
          validPurposeTemplateSeed.purposeFreeOfChargeReason,
        purposeRiskAnalysisForm: {
          id: expect.anything(),
          version: riskAnalysisVersion,
          singleAnswers: mockValidRiskAnalysisTemplateForm.singleAnswers
            // change "purpose" value to OTHER to enable "otherPurpose"
            .map((a: RiskAnalysisTemplateSingleAnswer) =>
              a.key === "purpose"
                ? {
                    ...a,
                    id: expect.anything(),
                    value: "OTHER",
                  }
                : {
                    ...a,
                    id: expect.anything(),
                  }
            )
            // "institutionalPurpose" not allow if "purpose" = OTHER
            .filter((a) => a.key !== "institutionalPurpose")
            // add new value to answer "otherPurpose"
            .concat({
              id: expect.anything(),
              value: "Updated Answer value",
              key: "otherPurpose",
              editable: false,
              suggestedValues: [],
            }),
          multiAnswers: mockValidRiskAnalysisTemplateForm.multiAnswers.map(
            (a) => ({
              ...a,
              id: expect.anything(),
            })
          ),
        },
      };

      const writtenEvent = await readLastPurposeTemplateEvent(
        updatedPurposeTemplateResponse.data.id
      );

      if (!writtenEvent) {
        fail("Creation failed: purpose template not found in event-store");
      }

      expect(writtenEvent).toMatchObject({
        stream_id: updatedPurposeTemplateResponse.data.id,
        version: "1",
        type: "PurposeTemplateDraftUpdated",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeTemplateAddedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload).toEqual({
        purposeTemplate: toPurposeTemplateV2(expectedPurposeTemplate),
      });

      expect(updatedPurposeTemplateResponse).toEqual({
        data: expectedPurposeTemplate,
        metadata: { version: 1 },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        {
          ...riskAnalysisFormTemplateSeed,
          answers: updatedAnswers,
        },
        tenantKind
      );
    }
  );

  it("Should throw a purposeTemplateNotFound error if purpose template does not exist", async () => {
    expect(
      purposeTemplateService.updatePurposeTemplate(
        existingPurposeTemplate.id,
        purposeTemplateSeed,
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(existingPurposeTemplate.id));
  });

  it("Should throw a purposeTemplateNotInDraftState error if purpose template is not in draft state", async () => {
    const purposeTemplateInActiveState: PurposeTemplate = {
      ...existingPurposeTemplate,
      state: purposeTemplateState.active,
    };

    await addOneTenant(creator);
    await addOnePurposeTemplate(purposeTemplateInActiveState);

    expect(
      purposeTemplateService.updatePurposeTemplate(
        purposeTemplateInActiveState.id,
        purposeTemplateSeed,
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotInExpectedStates(
        purposeTemplateInActiveState.id,
        purposeTemplateInActiveState.state,
        [purposeTemplateState.draft]
      )
    );
  });

  it("Should throw a tenantNotAllowed error if the creator tenant is not template creator", async () => {
    await addOneTenant(creator);
    await addOnePurposeTemplate({
      ...existingPurposeTemplate,
      creatorId: generateId(),
    });

    expect(
      purposeTemplateService.updatePurposeTemplate(
        existingPurposeTemplate.id,
        purposeTemplateSeed,
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      )
    ).rejects.toThrowError(tenantNotAllowed(creatorId));
  });

  it("Should throw a missingFreeOfChargeReason error if purposeIsFreeOfCharge is false and purposeFreeOfChargeReason is not provided", async () => {
    await addOnePurposeTemplate(existingPurposeTemplate);
    expect(
      purposeTemplateService.updatePurposeTemplate(
        existingPurposeTemplate.id,
        {
          ...purposeTemplateSeed,
          purposeIsFreeOfCharge: true,
          purposeFreeOfChargeReason: undefined,
        },
        getMockContext({
          authData: getMockAuthData(existingPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });

  it.skip("Should remove annotations documents for each answer deleted in purpose template seed, all annotation documents of answers not affected by update still remains in S3", async () => {
    vi.spyOn(fileManager, "delete");

    // Risk Analysis Form must be defined in existing purpose template for this test
    const purposeTemplateRiskAnalysisForm: RiskAnalysisFormTemplate =
      existingPurposeTemplate.purposeRiskAnalysisForm!;

    // Answer to be removed from risk analysis form
    const removedAnswerKey = "ruleOfLawText";

    // Answer that will contain an annotation with documents
    const answerKeyWithAnnotationDoc = "administrativeActText";

    // Annotation and their documents for an answer to be deleted
    const annotationDocsToDeleteNum = 2;
    const annotationDocsToDelete = Array.from({
      length: annotationDocsToDeleteNum,
    }).map((_, i) =>
      getMockRiskAnalysisTemplateAnswerAnnotationDocument(
        generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>(),
        existingPurposeTemplate.id,
        config.purposeTemplateDocumentsPath,
        `Document-Annotation-${i}`
      )
    );
    const annotationToDelete =
      getMockRiskAnalysisTemplateAnswerAnnotationWithDocs(
        generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
        annotationDocsToDelete
      );

    // Annotation and their documents for an answer not affected by update
    const annotationDocsNotAffectedNum = 3;
    const annotationDocsNotAffected = Array.from({
      length: annotationDocsNotAffectedNum,
    }).map((_, i) =>
      getMockRiskAnalysisTemplateAnswerAnnotationDocument(
        generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>(),
        existingPurposeTemplate.id,
        config.purposeTemplateDocumentsPath,
        `Document-Annotation-${i}`
      )
    );
    const notAffectedAnnotation =
      getMockRiskAnalysisTemplateAnswerAnnotationWithDocs(
        generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
        annotationDocsNotAffected
      );

    // Existing answer contains answer "removedAnswerKey" that has an annotation with documents
    const existingSingleAnswersWithAnnotation: RiskAnalysisTemplateSingleAnswer[] =
      [
        ...purposeTemplateRiskAnalysisForm.singleAnswers.filter(
          (a) => a.key !== removedAnswerKey
        ),
        {
          id: generateId(),
          key: removedAnswerKey,
          editable: true,
          suggestedValues: [],
          annotation: annotationToDelete,
        },
      ];

    // Existing Risk Analysis Form contains answers with annotation and documents
    const existingPurposeTemplateWithAnnotations: PurposeTemplate = {
      ...existingPurposeTemplate,
      purposeRiskAnalysisForm: {
        ...purposeTemplateRiskAnalysisForm,
        singleAnswers: existingSingleAnswersWithAnnotation,
      },
    };

    // Seeding DB and File storage for the tests
    await addOneTenant(creator);
    await addOnePurposeTemplate(existingPurposeTemplateWithAnnotations);
    const uploadPromises = [
      ...annotationToDelete.docs,
      ...notAffectedAnnotation.docs,
    ].map((d) => uploadDocument(existingPurposeTemplate.id, d.id, d.name));

    // wait for all asynchronous uploads to complete
    await Promise.all(uploadPromises);

    // Prepare test seed input
    const purposeTemplateSeedUpdated: purposeTemplateApi.PurposeTemplateSeed =
      new PurposeTemplateSeedApiBuilder(purposeTemplateSeed)
        .removeAnswer(removedAnswerKey)
        .addAnnotationToAnswer(
          answerKeyWithAnnotationDoc,
          notAffectedAnnotation
        )
        .build();

    const actualPurposeTemplate =
      await purposeTemplateService.updatePurposeTemplate(
        existingPurposeTemplateWithAnnotations.id,
        purposeTemplateSeedUpdated,
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      );

    // Expect that removed answer is not present in updated purpose template returned
    expect(
      actualPurposeTemplate.data.purposeRiskAnalysisForm?.singleAnswers.find(
        (a) => a.key === removedAnswerKey
      )
    ).toBeUndefined();

    const filePaths = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    // Expect that remains only valid annotation documents in S3
    expect(filePaths.length).toBe(annotationDocsNotAffectedNum);

    // Expect that documents are deleted from S3 and current files not contains their paths
    annotationToDelete.docs.forEach((d) => {
      expect(fileManager.delete).toHaveBeenCalledWith(
        config.s3Bucket,
        d.path,
        genericLogger
      );
      expect(filePaths).not.toContain(d.path);
    });
  });
});
