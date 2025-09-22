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
  purposeTemplateNotInDraftState,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import * as validators from "../../src/services/validators.js";
import {
  addOnePurposeTemplate,
  addOneTenant,
  fileManager,
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

  it.each([
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
      purposeTemplateNotInDraftState(purposeTemplateInActiveState.id)
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

  it("Should remove annotations documents for each request deleted in update", async () => {
    vi.spyOn(fileManager, "delete");
    const purposeTemplateRiskAnalysisForm: RiskAnalysisFormTemplate =
      existingPurposeTemplate.purposeRiskAnalysisForm!;

    const annotationDocToDeleteNum = 2;
    const validAnnotationDocsNum = 2;
    const annotationDocsToDelete = Array.from({
      length: annotationDocToDeleteNum,
    }).map((_, i) =>
      getMockRiskAnalysisTemplateAnswerAnnotationDocument(
        generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>(),
        existingPurposeTemplate.id,
        config.purposeTemplateAnnotationsPath,
        `Document-Annotation-${i}`
      )
    );

    const annotationToDelete =
      getMockRiskAnalysisTemplateAnswerAnnotationWithDocs(
        generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
        annotationDocsToDelete
      );

    const answerKeyWithAnnotationDoc = "administrativeActText";

    const validAnnotationDocs = Array.from({
      length: validAnnotationDocsNum,
      // eslint-disable-next-line sonarjs/no-identical-functions
    }).map((_, i) =>
      getMockRiskAnalysisTemplateAnswerAnnotationDocument(
        generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>(),
        existingPurposeTemplate.id,
        config.purposeTemplateAnnotationsPath,
        `Document-Annotation-${i}`
      )
    );
    const annotationWithDocs =
      getMockRiskAnalysisTemplateAnswerAnnotationWithDocs(
        generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
        validAnnotationDocs
      );

    const removedAnswerKey = "ruleOfLawText";
    const singleAnswersWithAnnotation: RiskAnalysisTemplateSingleAnswer[] = [
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

    const purposeTemplateWithAnnotations: PurposeTemplate = {
      ...existingPurposeTemplate,
      purposeRiskAnalysisForm: {
        ...purposeTemplateRiskAnalysisForm,
        singleAnswers: singleAnswersWithAnnotation,
      },
    };

    await addOneTenant(creator);
    await addOnePurposeTemplate(purposeTemplateWithAnnotations);

    [...annotationToDelete.docs, ...annotationWithDocs.docs].forEach((d) => {
      uploadDocument(existingPurposeTemplate.id, d.id, d.name);
    });

    const updatedPurposeTemplate =
      await purposeTemplateService.updatePurposeTemplate(
        purposeTemplateWithAnnotations.id,
        {
          ...purposeTemplateSeed,
          purposeRiskAnalysisForm: {
            ...purposeTemplateSeed.purposeRiskAnalysisForm,
            answers: {
              ...Object.fromEntries(
                Object.entries(
                  purposeTemplateSeed.purposeRiskAnalysisForm?.answers || {}
                )
                  .filter(([answerKey]) => answerKey !== removedAnswerKey)
                  .map(([answerKey, answer]) => {
                    if (answerKey === answerKeyWithAnnotationDoc) {
                      return [
                        answerKey,
                        {
                          ...answer,
                          annotation: annotationWithDocs,
                        },
                      ];
                    }
                    return [answerKey, answer];
                  })
              ),
            },
          } as purposeTemplateApi.RiskAnalysisFormTemplateSeed,
        },
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      );

    expect(
      updatedPurposeTemplate.data.purposeRiskAnalysisForm?.singleAnswers.find(
        (a) => a.key === removedAnswerKey
      )
    ).toBeUndefined();

    const filePaths = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(filePaths.length).toBe(validAnnotationDocsNum);

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
