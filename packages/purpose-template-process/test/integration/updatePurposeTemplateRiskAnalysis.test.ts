/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  genericLogger,
  getLatestVersionFormRules,
} from "pagopa-interop-commons";
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
} from "pagopa-interop-models";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { config } from "../../src/config/config.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
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

describe("updatePurposeTemplateRiskAnalysisRiskAnalysis", () => {
  const mockDate = new Date();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
  });
  const riskAnalysisPAVersion = getLatestVersionFormRules(
    tenantKind.PA
  )!.version;
  const riskAnalysisPrivateVersion = getLatestVersionFormRules(
    tenantKind.PRIVATE
  )!.version;
  const creatorId = generateId<TenantId>();
  const creator: Tenant = getMockTenant(creatorId);

  const mockValidRiskAnalysisTemplateForm =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);

  const riskAnalysisFormTemplateSeed = buildRiskAnalysisFormTemplateSeed(
    mockValidRiskAnalysisTemplateForm
  );

  const purposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed =
    getMockPurposeTemplateSeed(
      buildRiskAnalysisFormTemplateSeed(mockValidRiskAnalysisTemplateForm)
    );

  const existingPurposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(creatorId),
    purposeRiskAnalysisForm: mockValidRiskAnalysisTemplateForm,
  };

  it.each([
    { kind: tenantKind.PA, riskAnalysisVersion: riskAnalysisPAVersion },
    {
      kind: tenantKind.PRIVATE,
      riskAnalysisVersion: riskAnalysisPrivateVersion,
    },
  ])(
    "should successfully update a purpose template in draft state with valid data and targetTenantKind $kind",
    async ({ kind: tenantKind, riskAnalysisVersion }) => {
      const spy = vi.spyOn(
        validators,
        "validateAndTransformRiskAnalysisTemplate"
      );

      const mockValidRiskAnalysisTemplateFormWithKind =
        getMockValidRiskAnalysisFormTemplate(tenantKind);

      const riskAnalysisFormTemplateSeedWithKind = {
        ...buildRiskAnalysisFormTemplateSeed(
          mockValidRiskAnalysisTemplateFormWithKind
        ),
        version: riskAnalysisVersion,
      };

      const updatedAnswers = Object.fromEntries([
        ...Object.entries(riskAnalysisFormTemplateSeedWithKind.answers)
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
            values: [],
            suggestedValues: ["Updated Answer value", "Updated Answer value 2"],
          },
        ],
      ]);

      const updatedRiskAnalysisFormTemplateSeed = {
        ...riskAnalysisFormTemplateSeedWithKind,
        answers: updatedAnswers,
      };

      const existingPurposeTemplate: PurposeTemplate = {
        ...getMockPurposeTemplate(creatorId),
        targetTenantKind: tenantKind,
        purposeRiskAnalysisForm: {
          ...mockValidRiskAnalysisTemplateFormWithKind,
          version: riskAnalysisVersion,
        },
      };

      await addOnePurposeTemplate(existingPurposeTemplate);
      await addOneTenant(creator);

      const updatedPurposeTemplateRiskAnalysisResponse =
        await purposeTemplateService.updatePurposeTemplateRiskAnalysis(
          existingPurposeTemplate.id,
          updatedRiskAnalysisFormTemplateSeed,
          getMockContext({
            authData: getMockAuthData(creatorId),
          })
        );

      const expectedRiskAnalysisTemplateForm: RiskAnalysisFormTemplate = {
        id: expect.anything(),
        version: riskAnalysisVersion,
        singleAnswers: mockValidRiskAnalysisTemplateFormWithKind.singleAnswers
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
            value: undefined,
            key: "otherPurpose",
            editable: false,
            suggestedValues: ["Updated Answer value", "Updated Answer value 2"],
          }),
        multiAnswers:
          mockValidRiskAnalysisTemplateFormWithKind.multiAnswers.map((a) => ({
            ...a,
            id: expect.anything(),
          })),
      };

      const expectedPurposeTemplate: PurposeTemplate = {
        ...existingPurposeTemplate,
        purposeRiskAnalysisForm: expectedRiskAnalysisTemplateForm,
        updatedAt: mockDate,
      };

      const writtenEvent = await readLastPurposeTemplateEvent(
        expectedPurposeTemplate.id
      );

      if (!writtenEvent) {
        fail("Creation failed: purpose template not found in event-store");
      }

      expect(writtenEvent).toMatchObject({
        stream_id: expectedPurposeTemplate.id,
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

      expect(updatedPurposeTemplateRiskAnalysisResponse).toEqual({
        data: expectedRiskAnalysisTemplateForm,
        metadata: { version: 1 },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        {
          ...riskAnalysisFormTemplateSeedWithKind,
          answers: updatedAnswers,
        },
        tenantKind,
        expectedPurposeTemplate.handlesPersonalData
      );
    }
  );

  it("Should throw a purposeTemplateNotFound error if purpose template does not exist", async () => {
    expect(
      purposeTemplateService.updatePurposeTemplateRiskAnalysis(
        existingPurposeTemplate.id,
        riskAnalysisFormTemplateSeed,
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(existingPurposeTemplate.id));
  });

  it("Should throw a purposeTemplateNotInDraftState error if purpose template is not in draft state", async () => {
    const purposeTemplateInPublishedState: PurposeTemplate = {
      ...existingPurposeTemplate,
      state: purposeTemplateState.published,
    };

    await addOneTenant(creator);
    await addOnePurposeTemplate(purposeTemplateInPublishedState);

    expect(
      purposeTemplateService.updatePurposeTemplateRiskAnalysis(
        purposeTemplateInPublishedState.id,
        riskAnalysisFormTemplateSeed,
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotInExpectedStates(
        purposeTemplateInPublishedState.id,
        purposeTemplateInPublishedState.state,
        [purposeTemplateState.draft]
      )
    );
  });

  it("Should throw a purposeTemplateNotFound error if the requester tenant is not template creator", async () => {
    const requesterId = generateId<TenantId>();

    await addOneTenant(creator);
    await addOnePurposeTemplate(existingPurposeTemplate);

    expect(
      purposeTemplateService.updatePurposeTemplateRiskAnalysis(
        existingPurposeTemplate.id,
        riskAnalysisFormTemplateSeed,
        getMockContext({
          authData: getMockAuthData(requesterId),
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(existingPurposeTemplate.id));
  });

  it("Should remove annotations documents for each answer deleted in risk analysis form template seed, all annotation documents of answers not affected by update still remain in S3", async () => {
    vi.spyOn(fileManager, "delete");

    // Risk Analysis Form must be defined in existing purpose template for this test
    const purposeTemplateRiskAnalysisForm: RiskAnalysisFormTemplate =
      existingPurposeTemplate.purposeRiskAnalysisForm!;

    // Answer to be removed from risk analysis form
    const removedAnswerKey = "ruleOfLawText";

    // Answer that will contain an annotation with documents
    const answerKeyWithAnnotationDoc = "usesPersonalData";

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

    const actualPurposeTemplateRiskAnalysis =
      await purposeTemplateService.updatePurposeTemplateRiskAnalysis(
        existingPurposeTemplateWithAnnotations.id,
        purposeTemplateSeedUpdated.purposeRiskAnalysisForm!,
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      );

    // Expect that removed answer is not present in updated purpose template returned
    expect(
      actualPurposeTemplateRiskAnalysis.data?.singleAnswers.find(
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

  it("Should update risk analysis of purpose template, existent annotations documents for each answer not affected by update still remains in S3 and document references are returned", async () => {
    vi.spyOn(fileManager, "delete");

    // Answer to be removed from risk analysis form
    const answerKeyWithAnnotationDocs = "purpose";

    // Risk Analysis Form must be defined in existing purpose template for this test
    const purposeTemplateRiskAnalysisForm: RiskAnalysisFormTemplate =
      existingPurposeTemplate.purposeRiskAnalysisForm!;

    // Annotation and their documents for an answer not affected by update
    const annotationDocsNotAffectedNum = 2;
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

    // Existing answer contains answer that has an annotation with documents
    const updatedAnnotationText = "Updated Annotation Text";
    const existingSingleAnswersWithAnnotation: RiskAnalysisTemplateSingleAnswer[] =
      [
        ...purposeTemplateRiskAnalysisForm.singleAnswers.filter(
          (a) => a.key !== answerKeyWithAnnotationDocs
        ),
        {
          id: generateId(),
          key: answerKeyWithAnnotationDocs,
          editable: true,
          suggestedValues: [],
          annotation: notAffectedAnnotation,
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
    const uploadPromises = notAffectedAnnotation.docs.map((d) =>
      uploadDocument(existingPurposeTemplate.id, d.id, d.name)
    );

    // wait for all asynchronous uploads to complete
    await Promise.all(uploadPromises);

    // Prepare test seed input
    const purposeTemplateSeedUpdated: purposeTemplateApi.PurposeTemplateSeed =
      new PurposeTemplateSeedApiBuilder(purposeTemplateSeed)
        .addAnnotationToAnswer(answerKeyWithAnnotationDocs, {
          text: updatedAnnotationText,
        })
        .build();

    const actualPurposeTemplate =
      await purposeTemplateService.updatePurposeTemplateRiskAnalysis(
        existingPurposeTemplateWithAnnotations.id,
        purposeTemplateSeedUpdated.purposeRiskAnalysisForm!,
        getMockContext({
          authData: getMockAuthData(creatorId),
        })
      );

    // Expect that updated answer returned have document that already exists in purpose template
    const answerUpdatedWithDocs =
      actualPurposeTemplate.data?.singleAnswers.find(
        (a) => a.key === answerKeyWithAnnotationDocs
      );
    expect(answerUpdatedWithDocs).toBeDefined();
    const docs = answerUpdatedWithDocs?.annotation?.docs;

    expect(docs).toBeDefined();
    expect(docs?.length).toBe(annotationDocsNotAffectedNum);

    const filePaths = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    // Expect that remains only valid annotation documents in S3
    expect(filePaths.length).toBe(annotationDocsNotAffectedNum);
  });
});
