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
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  unexpectedRiskAnalysisTemplateFieldError,
  unexpectedRiskAnalysisTemplateFieldValueError,
} from "pagopa-interop-commons";
import {
  hyperlinkDetectionError,
  purposeTemplateNotFound,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";

describe("createPurposeTemplateRiskAnalysisAnswer", () => {
  const mockPurposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: getMockValidRiskAnalysisFormTemplate(
      tenantKind.PA
    ),
  };

  it("should write on event-store for the creation of a risk analysis answer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    const validRiskAnalysisAnswerRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        answerKey: "purpose",
        answerData: {
          values: ["INSTITUTIONAL"],
          editable: false,
          suggestedValues: [],
          annotation: {
            text: "Risk analysis template answer annotation text",
            docs: [],
          },
        },
      };

    const createRiskAnalysisAnswerResponse =
      await purposeTemplateService.createRiskAnalysisAnswer(
        mockPurposeTemplate.id,
        validRiskAnalysisAnswerRequest,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      );

    const writtenEvent = await readLastPurposeTemplateEvent(
      mockPurposeTemplate.id
    );

    if (!writtenEvent) {
      fail("Creation failed: purpose template event not found in event-store");
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

    expect(createRiskAnalysisAnswerResponse.data).toMatchObject({
      key: validRiskAnalysisAnswerRequest.answerKey,
      value: validRiskAnalysisAnswerRequest.answerData.values[0],
      editable: validRiskAnalysisAnswerRequest.answerData.editable,
      suggestedValues:
        validRiskAnalysisAnswerRequest.answerData.suggestedValues,
      annotation: validRiskAnalysisAnswerRequest.answerData.annotation,
    });

    expect(writtenPayload.purposeTemplate).toBeDefined();
    expect(
      writtenPayload.purposeTemplate!.purposeRiskAnalysisForm
    ).toBeDefined();

    vi.useRealTimers();
  });

  it("should throw hyperlinkDetectionError if annotation text contains hyperlinks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    const textWithHyperlink =
      "This text contains a hyperlink: https://example.com";
    const requestWithHyperlink: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        answerKey: "purpose",
        answerData: {
          values: ["INSTITUTIONAL"],
          editable: true,
          suggestedValues: [],
          annotation: {
            text: textWithHyperlink,
            docs: [],
          },
        },
      };

    await expect(
      purposeTemplateService.createRiskAnalysisAnswer(
        mockPurposeTemplate.id,
        requestWithHyperlink,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(hyperlinkDetectionError(textWithHyperlink));

    vi.useRealTimers();
  });

  it("should NOT throw hyperlinkDetectionError if annotation text contains simply a domain", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    const textWithHyperlink =
      "The company beta.com is authorized to process data.";
    const requestWithHyperlink: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        answerKey: "purpose",
        answerData: {
          values: ["INSTITUTIONAL"],
          editable: true,
          suggestedValues: [],
          annotation: {
            text: textWithHyperlink,
            docs: [],
          },
        },
      };

    await expect(
      purposeTemplateService.createRiskAnalysisAnswer(
        mockPurposeTemplate.id,
        requestWithHyperlink,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).not.rejects.toThrowError(hyperlinkDetectionError(textWithHyperlink));

    vi.useRealTimers();
  });

  it("should throw purposeTemplateRiskAnalysisFormNotFound if purpose template has no risk analysis form", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const purposeTemplateWithoutRiskAnalysis: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeRiskAnalysisForm: undefined,
    };

    await addOnePurposeTemplate(purposeTemplateWithoutRiskAnalysis);

    const validRiskAnalysisAnswerRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        answerKey: "purpose",
        answerData: {
          values: ["INSTITUTIONAL"],
          editable: true,
          suggestedValues: [],
        },
      };

    await expect(
      purposeTemplateService.createRiskAnalysisAnswer(
        purposeTemplateWithoutRiskAnalysis.id,
        validRiskAnalysisAnswerRequest,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(
        purposeTemplateWithoutRiskAnalysis.id
      )
    );

    vi.useRealTimers();
  });

  it("should throw riskAnalysisTemplateValidationFailed for invalid field", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    const invalidKey = "nonExistentField";

    const invalidFieldRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        answerKey: invalidKey,
        answerData: {
          values: ["someValue"],
          editable: true,
          suggestedValues: [],
        },
      };

    await expect(
      purposeTemplateService.createRiskAnalysisAnswer(
        mockPurposeTemplate.id,
        invalidFieldRequest,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateValidationFailed([
        unexpectedRiskAnalysisTemplateFieldError(invalidKey),
      ])
    );

    vi.useRealTimers();
  });

  it("should throw riskAnalysisTemplateValidationFailed for invalid field value", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOnePurposeTemplate(mockPurposeTemplate);

    const invalidValueRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        answerKey: "purpose",
        answerData: {
          values: ["INVALID_VALUE"],
          editable: false,
          suggestedValues: [],
        },
      };

    await expect(
      purposeTemplateService.createRiskAnalysisAnswer(
        mockPurposeTemplate.id,
        invalidValueRequest,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateValidationFailed([
        unexpectedRiskAnalysisTemplateFieldValueError(
          "purpose",
          new Set(["INSTITUTIONAL", "OTHER"])
        ),
      ])
    );

    vi.useRealTimers();
  });

  it("should throw purposeTemplateNotFound if purpose template is not found", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const validRiskAnalysisAnswerRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        answerKey: "purpose",
        answerData: {
          values: ["INSTITUTIONAL"],
          editable: true,
          suggestedValues: [],
        },
      };

    await expect(
      purposeTemplateService.createRiskAnalysisAnswer(
        mockPurposeTemplate.id,
        validRiskAnalysisAnswerRequest,
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

    const validRiskAnalysisAnswerRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest =
      {
        answerKey: "purpose",
        answerData: {
          values: ["INSTITUTIONAL"],
          editable: true,
          suggestedValues: [],
        },
      };

    const differentCreatorId = generateId<TenantId>();

    await expect(
      purposeTemplateService.createRiskAnalysisAnswer(
        mockPurposeTemplate.id,
        validRiskAnalysisAnswerRequest,
        getMockContext({
          authData: getMockAuthData(differentCreatorId),
        })
      )
    ).rejects.toThrowError(tenantNotAllowed(differentCreatorId));

    vi.useRealTimers();
  });
});
