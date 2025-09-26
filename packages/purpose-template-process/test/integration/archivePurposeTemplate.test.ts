/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockValidRiskAnalysisFormTemplate,
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  tenantKind,
  TenantId,
  PurposeTemplate,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  purposeTemplateState,
  toPurposeTemplateV2,
  PurposeTemplateArchivedV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import {
  purposeTemplateStateConflict,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { archivableInitialStates } from "../../src/services/validators.js";

describe("archivePurposeTemplate", () => {
  const creatorId = generateId<TenantId>();
  const incompleteRiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);
  const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
    ...incompleteRiskAnalysisFormTemplate,
    singleAnswers: incompleteRiskAnalysisFormTemplate.singleAnswers.map(
      (a): RiskAnalysisTemplateSingleAnswer => ({
        ...a,
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
        },
        suggestedValues: [],
      })
    ),
    multiAnswers: incompleteRiskAnalysisFormTemplate.multiAnswers.map(
      (a): RiskAnalysisTemplateMultiAnswer => ({
        ...a,
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
        },
      })
    ),
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    updatedAt: new Date(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    purposeFreeOfChargeReason: "Free of charge reason",
    purposeDailyCalls: 100,
    state: purposeTemplateState.active,
    creatorId,
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it.each(archivableInitialStates)(
    "should write on event-store for the archiving of a purpose template in %s state",
    async (state) => {
      const metadataVersion = 1;
      await addOnePurposeTemplate(
        { ...purposeTemplate, state },
        metadataVersion
      );

      const archiveResponse =
        await purposeTemplateService.archivePurposeTemplate(
          purposeTemplate.id,
          getMockContext({ authData: getMockAuthData(creatorId) })
        );

      const updatedPurposeTemplate = archiveResponse.data;

      const writtenEvent = await readLastPurposeTemplateEvent(
        purposeTemplate.id
      );

      const expectedMetadataVersion = metadataVersion + 1;

      expect(writtenEvent).toMatchObject({
        stream_id: purposeTemplate.id,
        version: String(expectedMetadataVersion),
        type: "PurposeTemplateArchived",
        event_version: 2,
      });

      const expectedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.archived,
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeTemplateArchivedV2,
        payload: writtenEvent.data,
      });

      expect(sortPurposeTemplate(writtenPayload.purposeTemplate)).toEqual(
        sortPurposeTemplate(toPurposeTemplateV2(expectedPurposeTemplate))
      );
      expect(archiveResponse).toMatchObject({
        data: updatedPurposeTemplate,
        metadata: { version: expectedMetadataVersion },
      });
    }
  );

  it("should throw tenantNotAllowed if the caller is not the creator of the purpose template", async () => {
    await addOnePurposeTemplate(purposeTemplate);

    const otherTenantId = generateId<TenantId>();

    await expect(async () => {
      await purposeTemplateService.archivePurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(otherTenantId) })
      );
    }).rejects.toThrowError(tenantNotAllowed(otherTenantId));
  });

  it(`should throw purposeTemplateStateConflict if the purpose template is archived`, async () => {
    const purposeTemplateWithUnexpectedState: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.archived,
    };

    await addOnePurposeTemplate(purposeTemplateWithUnexpectedState);

    await expect(async () => {
      await purposeTemplateService.archivePurposeTemplate(
        purposeTemplateWithUnexpectedState.id,
        getMockContext({ authData: getMockAuthData(creatorId) })
      );
    }).rejects.toThrowError(
      purposeTemplateStateConflict(
        purposeTemplateWithUnexpectedState.id,
        purposeTemplateWithUnexpectedState.state
      )
    );
  });
});
