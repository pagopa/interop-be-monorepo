/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getLatestVersionFormRules,
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate,
  validatePurposeTemplateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockCompleteRiskAnalysisFormTemplate,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockPurposeTemplate,
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  EService,
  EServiceId,
  generateId,
  PurposeTemplate,
  PurposeTemplatePublishedV2,
  purposeTemplateState,
  TenantId,
  tenantKind,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { invalidDescriptorStateForPublishingError } from "../../src/errors/purposeTemplateValidationErrors.js";
import {
  invalidAssociatedEServiceForPublishError,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { ALLOWED_DESCRIPTOR_STATES_FOR_PUBLISHING } from "../../src/services/validators.js";
import {
  addOneEService,
  addOnePurposeTemplate,
  addOnePurposeTemplateEServiceDescriptor,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";

describe("publishPurposeTemplate", () => {
  const creatorId = generateId<TenantId>();
  const riskAnalysisFormTemplate = getMockCompleteRiskAnalysisFormTemplate();

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    updatedAt: new Date(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    purposeFreeOfChargeReason: "Free of charge reason",
    purposeDailyCalls: 100,
    state: purposeTemplateState.draft,
    creatorId,
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the publishing of a purpose template in draft state", async () => {
    await addOnePurposeTemplate(purposeTemplate);

    const publishResponse = await purposeTemplateService.publishPurposeTemplate(
      purposeTemplate.id,
      getMockContext({ authData: getMockAuthData(creatorId) })
    );

    const updatedPurposeTemplate = publishResponse.data;

    const writtenEvent = await readLastPurposeTemplateEvent(purposeTemplate.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "1",
      type: "PurposeTemplatePublished",
      event_version: 2,
    });

    const expectedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.published,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeTemplatePublishedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurposeTemplate(writtenPayload.purposeTemplate)).toEqual(
      sortPurposeTemplate(toPurposeTemplateV2(expectedPurposeTemplate))
    );
    expect(publishResponse).toMatchObject({
      data: updatedPurposeTemplate,
      metadata: { version: 1 },
    });
  });

  it("should throw tenantNotAllowed if the caller is not the creator of the purpose template", async () => {
    await addOnePurposeTemplate(purposeTemplate);

    const otherTenantId = generateId<TenantId>();

    await expect(async () => {
      await purposeTemplateService.publishPurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(otherTenantId) })
      );
    }).rejects.toThrowError(tenantNotAllowed(otherTenantId));
  });

  it("should throw purposeTemplateRiskAnalysisFormNotFound if the purpose template has no risk analysis template", async () => {
    const purposeTemplateWithoutRiskAnalysis: PurposeTemplate = {
      ...purposeTemplate,
      purposeRiskAnalysisForm: undefined,
    };

    await addOnePurposeTemplate(purposeTemplateWithoutRiskAnalysis);

    await expect(async () => {
      await purposeTemplateService.publishPurposeTemplate(
        purposeTemplateWithoutRiskAnalysis.id,
        getMockContext({ authData: getMockAuthData(creatorId) })
      );
    }).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(
        purposeTemplateWithoutRiskAnalysis.id
      )
    );
  });

  it("should throw riskAnalysisTemplateValidationFailed if the purpose template has an invalid risk analysis template", async () => {
    const purposeTemplateWithInvalidRiskAnalysis: PurposeTemplate = {
      ...purposeTemplate,
      purposeRiskAnalysisForm: {
        id: generateId(),
        version: getLatestVersionFormRules(tenantKind.PA)!.version,
        singleAnswers: [
          {
            id: generateId(),
            key: "wrong-key",
            editable: true,
            suggestedValues: [],
          },
        ],
        multiAnswers: [],
      },
    };

    await addOnePurposeTemplate(purposeTemplateWithInvalidRiskAnalysis);

    const result = validatePurposeTemplateRiskAnalysis(
      riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
        purposeTemplateWithInvalidRiskAnalysis.purposeRiskAnalysisForm!
      ),
      purposeTemplateWithInvalidRiskAnalysis.targetTenantKind,
      purposeTemplateWithInvalidRiskAnalysis.handlesPersonalData
    );

    await expect(async () => {
      await purposeTemplateService.publishPurposeTemplate(
        purposeTemplateWithInvalidRiskAnalysis.id,
        getMockContext({ authData: getMockAuthData(creatorId) })
      );
    }).rejects.toThrowError(
      riskAnalysisTemplateValidationFailed(
        result.type === "invalid" ? result.issues : []
      )
    );
  });

  it.each([
    {
      error: purposeTemplateStateConflict(
        purposeTemplate.id,
        purposeTemplateState.published
      ),
      state: purposeTemplateState.published,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplate.id,
        purposeTemplateState.archived,
        [purposeTemplateState.draft]
      ),
      state: purposeTemplateState.archived,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplate.id,
        purposeTemplateState.suspended,
        [purposeTemplateState.draft]
      ),
      state: purposeTemplateState.suspended,
    },
  ])(
    `should throw $error.code if the purpose template is in $state state`,
    async ({ error, state }) => {
      const purposeTemplateWithUnexpectedState: PurposeTemplate = {
        ...purposeTemplate,
        state,
      };

      await addOnePurposeTemplate(purposeTemplateWithUnexpectedState);

      await expect(async () => {
        await purposeTemplateService.publishPurposeTemplate(
          purposeTemplateWithUnexpectedState.id,
          getMockContext({ authData: getMockAuthData(creatorId) })
        );
      }).rejects.toThrowError(error);
    }
  );

  it("should throw unexpectedAssociationEServicePublishError if purpose template is linked to at least one archived eservice", async () => {
    await addOnePurposeTemplate(purposeTemplate);

    const invalidStateEService: EService = {
      ...getMockEService(generateId<EServiceId>(), generateId<TenantId>(), [
        getMockDescriptor(descriptorState.archived),
      ]),
      personalData: true,
    };
    const relatedEServices: EService[] = [
      ...Array.from({ length: 3 }).map(() => ({
        ...getMockEService(generateId<EServiceId>(), generateId<TenantId>(), [
          getMockDescriptor(descriptorState.published),
        ]),
        personalData: true,
      })),
      invalidStateEService,
    ];

    await Promise.all(
      relatedEServices.map((eservice) => addOneEService(eservice))
    );

    await Promise.all(
      relatedEServices.map((eservice) =>
        addOnePurposeTemplateEServiceDescriptor({
          purposeTemplateId: purposeTemplate.id,
          eserviceId: eservice.id,
          descriptorId: eservice.descriptors[0].id,
          createdAt: new Date(),
        })
      )
    );

    await expect(async () => {
      await purposeTemplateService.publishPurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(creatorId) })
      );
    }).rejects.toThrowError(
      invalidAssociatedEServiceForPublishError([
        invalidDescriptorStateForPublishingError(
          {
            purposeTemplateId: purposeTemplate.id,
            eserviceId: invalidStateEService.id,
            descriptorId: invalidStateEService.descriptors[0].id,
            createdAt: expect.any(Date),
          },
          ALLOWED_DESCRIPTOR_STATES_FOR_PUBLISHING
        ),
      ])
    );
  });
});
