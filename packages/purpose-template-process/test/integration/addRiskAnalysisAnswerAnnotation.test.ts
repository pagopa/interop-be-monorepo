/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateDraftUpdatedV2,
  tenantKind,
  generateId,
  TenantId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  // hyperlinkDetectionError,
  purposeTemplateNotFound,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";

describe("addRiskAnalysisAnswerAnnotation", () => {
  const mockPurposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: getMockValidRiskAnalysisFormTemplate(
      tenantKind.PA
    ),
  };

  it("should write on event-store for the addition of a risk analysis answer annotation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    const existingAnswer =
      mockPurposeTemplate.purposeRiskAnalysisForm!.singleAnswers[0];
    const answerId = existingAnswer.id;

    const validRiskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: "This is a test annotation for the risk analysis answer",
      };

    const addRiskAnalysisAnswerAnnotationResponse =
      await purposeTemplateService.addRiskAnalysisAnswerAnnotation(
        mockPurposeTemplate.id,
        answerId,
        validRiskAnalysisAnswerAnnotationRequest,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      );

    const writtenEvent = await readLastPurposeTemplateEvent(
      mockPurposeTemplate.id
    );

    if (!writtenEvent) {
      fail(
        "Annotation addition failed: purpose template event not found in event-store"
      );
    }

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurposeTemplate.id,
      version: "1",
      type: "PurposeTemplateDraftUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeTemplateDraftUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(addRiskAnalysisAnswerAnnotationResponse.data).toMatchObject({
      text: validRiskAnalysisAnswerAnnotationRequest.text,
      docs: [],
    });

    expect(writtenPayload.purposeTemplate).toBeDefined();
    expect(
      writtenPayload.purposeTemplate!.purposeRiskAnalysisForm
    ).toBeDefined();

    // Verify that the annotation was added to the correct answer
    const riskAnalysisForm =
      writtenPayload.purposeTemplate!.purposeRiskAnalysisForm!;
    const annotatedAnswer = riskAnalysisForm.singleAnswers.find(
      (answer) => answer.id === answerId
    );
    expect(annotatedAnswer?.annotation).toBeDefined();
    expect(annotatedAnswer?.annotation?.text).toBe(
      validRiskAnalysisAnswerAnnotationRequest.text
    );

    vi.useRealTimers();
  });

  it("should update existing annotation when answer already has one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    // Create a purpose template with an answer that already has an annotation
    const mockPurposeTemplateWithAnnotation: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeRiskAnalysisForm: {
        ...getMockValidRiskAnalysisFormTemplate(tenantKind.PA),
        singleAnswers: [
          {
            ...getMockValidRiskAnalysisFormTemplate(tenantKind.PA)
              .singleAnswers[0],
            annotation: {
              id: generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
              text: "Original annotation text",
              docs: [],
            },
          },
          ...getMockValidRiskAnalysisFormTemplate(
            tenantKind.PA
          ).singleAnswers.slice(1),
        ],
      },
    };

    await addOnePurposeTemplate(mockPurposeTemplateWithAnnotation);

    const existingAnswer =
      mockPurposeTemplateWithAnnotation.purposeRiskAnalysisForm!
        .singleAnswers[0];
    const answerId = existingAnswer.id;
    const originalAnnotationId = existingAnswer.annotation!.id;

    // Verify that the answer initially has an annotation
    expect(existingAnswer.annotation).toBeDefined();
    expect(existingAnswer.annotation!.text).toBe("Original annotation text");

    // Now update the annotation
    const updatedAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: "Updated annotation text",
      };

    const updatedAnnotationResponse =
      await purposeTemplateService.addRiskAnalysisAnswerAnnotation(
        mockPurposeTemplateWithAnnotation.id,
        answerId,
        updatedAnnotationRequest,
        getMockContext({
          authData: getMockAuthData(
            mockPurposeTemplateWithAnnotation.creatorId
          ),
        })
      );

    // Verify that the annotation was updated (same ID, new text)
    expect(updatedAnnotationResponse.data.text).toBe(
      updatedAnnotationRequest.text
    );
    expect(updatedAnnotationResponse.data.id).toBe(originalAnnotationId);

    vi.useRealTimers();
  });

  // todo disabled until hyperlinks validation rules are defined
  /* it("should throw hyperlinkDetectionError if annotation text contains hyperlinks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    // Use an existing answer from the mock purpose template
    const existingAnswer =
      mockPurposeTemplate.purposeRiskAnalysisForm!.singleAnswers[0];
    const answerId = existingAnswer.id;

    const textWithHyperlink =
      "This text contains a hyperlink: https://example.com";
    const requestWithHyperlink: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: textWithHyperlink,
      };

    await expect(
      purposeTemplateService.addRiskAnalysisAnswerAnnotation(
        mockPurposeTemplate.id,
        answerId,
        requestWithHyperlink,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(hyperlinkDetectionError(textWithHyperlink));

    vi.useRealTimers();
  }); */

  it("should throw purposeTemplateRiskAnalysisFormNotFound if purpose template has no risk analysis form", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const purposeTemplateWithoutRiskAnalysis: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeRiskAnalysisForm: undefined,
    };

    await addOnePurposeTemplate(purposeTemplateWithoutRiskAnalysis);

    const validRiskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: "This is a test annotation",
      };

    await expect(
      purposeTemplateService.addRiskAnalysisAnswerAnnotation(
        purposeTemplateWithoutRiskAnalysis.id,
        generateId<RiskAnalysisSingleAnswerId>(),
        validRiskAnalysisAnswerAnnotationRequest,
        getMockContext({
          authData: getMockAuthData(
            purposeTemplateWithoutRiskAnalysis.creatorId
          ),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(
        purposeTemplateWithoutRiskAnalysis.id
      )
    );

    vi.useRealTimers();
  });

  it("should throw riskAnalysisAnswerNotFound if answer is not found", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    const nonExistentAnswerId = generateId<RiskAnalysisSingleAnswerId>();
    const validRiskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: "This is a test annotation",
      };

    await expect(
      purposeTemplateService.addRiskAnalysisAnswerAnnotation(
        mockPurposeTemplate.id,
        nonExistentAnswerId,
        validRiskAnalysisAnswerAnnotationRequest,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerNotFound({ answerId: nonExistentAnswerId })
    );

    vi.useRealTimers();
  });

  it("should throw purposeTemplateNotFound if purpose template is not found", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const validRiskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: "This is a test annotation",
      };

    await expect(
      purposeTemplateService.addRiskAnalysisAnswerAnnotation(
        mockPurposeTemplate.id,
        generateId<RiskAnalysisSingleAnswerId>(),
        validRiskAnalysisAnswerAnnotationRequest,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(mockPurposeTemplate.id));

    vi.useRealTimers();
  });

  it("should throw tenantNotAllowed if the requester is not the creator", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    const existingAnswer =
      mockPurposeTemplate.purposeRiskAnalysisForm!.singleAnswers[0];
    const answerId = existingAnswer.id;

    const validRiskAnalysisAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText =
      {
        text: "This is a test annotation",
      };

    const differentCreatorId = generateId<TenantId>();

    await expect(
      purposeTemplateService.addRiskAnalysisAnswerAnnotation(
        mockPurposeTemplate.id,
        answerId,
        validRiskAnalysisAnswerAnnotationRequest,
        getMockContext({
          authData: getMockAuthData(differentCreatorId),
        })
      )
    ).rejects.toThrowError(tenantNotAllowed(differentCreatorId));

    vi.useRealTimers();
  });
});
