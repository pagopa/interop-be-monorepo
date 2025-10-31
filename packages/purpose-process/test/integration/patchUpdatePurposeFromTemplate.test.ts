/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { purposeApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockContextM2MAdmin,
  getMockDelegation,
  getMockEService,
  getMockPurpose,
  getMockPurposeTemplate,
  getMockPurposeVersion,
  getMockTenant,
  getMockValidRiskAnalysis,
  getMockValidRiskAnalysisFormTemplate,
  randomArrayItem,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  delegationKind,
  delegationState,
  DraftPurposeUpdatedV2,
  EService,
  EServiceId,
  eserviceMode,
  generateId,
  Purpose,
  PurposeId,
  PurposeTemplate,
  PurposeVersionState,
  purposeVersionState,
  RiskAnalysisFormTemplate,
  Tenant,
  TenantId,
  tenantKind,
  toPurposeV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  duplicatedPurposeTitle,
  eserviceNotFound,
  purposeDraftVersionNotFound,
  purposeNotFound,
  purposeTemplateNotFound,
  riskAnalysisAnswerNotInSuggestValues,
  riskAnalysisContainsNotEditableAnswers,
  riskAnalysisMissingExpectedFieldError,
  riskAnalysisVersionMismatch,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOnePurposeTemplate,
  addOneTenant,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("patchUpdatePurposeFromTemplate", () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  // Function to pick a random purpose state different from Draft
  const getRandomNonPurposeStateWithout = (
    purposeStateToFilter: PurposeVersionState
  ): PurposeVersionState =>
    randomArrayItem(
      Object.values(purposeVersionState).filter(
        (state) => state !== purposeStateToFilter
      )
    );

  async function expectWrittenEventAndGetPayload(
    purposeId: PurposeId
  ): Promise<DraftPurposeUpdatedV2> {
    const writtenEvent = await readLastPurposeEvent(purposeId);
    expect(writtenEvent).toMatchObject({
      stream_id: purposeId,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });
    return decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });
  }

  async function expectUpdatedPurpose(
    updatePurpose: Purpose,
    writtenPayload: DraftPurposeUpdatedV2,
    expectedPurpose: Purpose
  ): Promise<void> {
    const sortedExpectedPurpose = sortPurpose(expectedPurpose);
    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    const sortedUpdatePurpose = sortPurpose(updatePurpose);

    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(sortedExpectedPurpose))
    );
    expect(sortedUpdatePurpose).toEqual(sortedExpectedPurpose);
  }

  const testTenantKind = tenantKind.PA;
  const consumer: Tenant = {
    ...getMockTenant(),
    kind: testTenantKind,
  };

  const eservice: EService = {
    ...getMockEService(),
    mode: eserviceMode.deliver,
    personalData: true,
  };

  const mockValidRiskAnalysis = getMockValidRiskAnalysis(testTenantKind);
  const validRiskAnalysis = {
    ...mockValidRiskAnalysis,
    version: "3.1",
    // remove legalObligationReference from DRAFT purpose risk analysis form, added in test
    singleAnswers: {
      ...mockValidRiskAnalysis.riskAnalysisForm.singleAnswers,
      legalObligationReference: undefined,
    },
  };

  // ========================
  // Purpose Seed
  // ========================
  const draftPurpose: Purpose = {
    ...getMockPurpose([getMockPurposeVersion()]),
    eserviceId: eservice.id,
    consumerId: consumer.id,
    riskAnalysisForm: validRiskAnalysis.riskAnalysisForm,
  };

  const updatedSingleAnswersWithFreeText = {
    publicInterestTaskText: ["Public interest something"],
  };

  const updatedSingleAnswerFreeTextWithSuggestValue = {
    legalObligationReference: ["Decreto Legislativo n. 196/2003, art. 15"],
  };

  // This value is used to ensure consistency between the risk analysis in purpose template mock and purpose mock
  const legalBasisPublicInterest = {
    legalBasisPublicInterest: ["PUBLIC_INTEREST_TASK"],
  };

  // ========================
  // Purpose Template Seed
  // ========================
  const mockPurposeRiskAnalysisForm: RiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(testTenantKind);

  const validRiskAnalysisFormTemplate = {
    ...mockPurposeRiskAnalysisForm,
    singleAnswers: mockPurposeRiskAnalysisForm.singleAnswers
      .filter((a) => a.key !== "ruleOfLawText")
      .map((a) =>
        match(a.key)
          .with("legalBasisPublicInterest", () => ({
            ...a,
            editable: false,
            value: legalBasisPublicInterest.legalBasisPublicInterest[0],
          }))
          .with("legalObligationReference", () => ({
            ...a,
            editable: false,
            value: undefined,
            suggestedValues: [
              "Decreto Legislativo n. 196/2003, art. 15",
              "Regolamento UE 2016/679, art. 6",
              "Legge n. 241/1990, art. 22",
            ],
          }))
          .otherwise(() => a)
      ),
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(consumer.id, "Published"),
    purposeRiskAnalysisForm: validRiskAnalysisFormTemplate,
  };

  it("Should write on event store for the patch update of a purpose updating fields", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOnePurposeTemplate(purposeTemplate);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "Updated title",
      dailyCalls: 666,
      riskAnalysisForm: {
        version: "3.1",
        answers: {
          ...updatedSingleAnswersWithFreeText,
          ...updatedSingleAnswerFreeTextWithSuggestValue,
        },
      },
    };
    const updatePurpose = await purposeService.patchUpdatePurposeFromTemplate(
      purposeTemplate.id,
      draftPurpose.id,
      updateContent,
      getMockContextM2MAdmin({
        organizationId: consumer.id,
      })
    );

    const writtenPayload = await expectWrittenEventAndGetPayload(
      draftPurpose.id
    );

    const expectedPurpose: Purpose = sortPurpose({
      ...draftPurpose,
      title: updateContent.title!,
      versions: [
        {
          createdAt: draftPurpose.versions[0].createdAt,
          dailyCalls: updateContent.dailyCalls!,
          firstActivationAt: draftPurpose.versions[0].firstActivationAt,
          id: draftPurpose.versions[0].id,
          riskAnalysis: draftPurpose.versions[0].riskAnalysis,
          state: draftPurpose.versions[0].state,
          updatedAt: new Date(),
          suspendedAt: draftPurpose.versions[0].suspendedAt,
          stamps: draftPurpose.versions[0].stamps,
        },
      ],
      riskAnalysisForm: {
        ...draftPurpose.riskAnalysisForm!,
        id: expect.any(String),
        multiAnswers: draftPurpose.riskAnalysisForm!.multiAnswers.map((a) => ({
          ...a,
          id: expect.any(String),
        })),
        singleAnswers: [
          ...draftPurpose
            .riskAnalysisForm!.singleAnswers.filter(
              (a) => a.key !== "ruleOfLawText"
            )
            .map((a) =>
              match(a.key)
                .with("legalBasisPublicInterest", () => ({
                  ...a,
                  id: expect.any(String),
                  value: legalBasisPublicInterest.legalBasisPublicInterest[0],
                }))
                .with("publicInterestTaskText", () => ({
                  ...a,
                  id: expect.any(String),
                  value:
                    updatedSingleAnswersWithFreeText.publicInterestTaskText[0],
                }))
                .with("legalObligationReference", () => ({
                  ...a,
                  id: expect.any(String),
                  value:
                    updatedSingleAnswerFreeTextWithSuggestValue
                      .legalObligationReference[0],
                }))
                .otherwise(() => ({ ...a, id: expect.any(String) }))
            ),
          {
            id: expect.any(String),
            key: "publicInterestTaskText",
            value: updatedSingleAnswersWithFreeText.publicInterestTaskText[0],
          },
        ],
      },
      updatedAt: new Date(),
    });

    await expectUpdatedPurpose(
      updatePurpose.data,
      writtenPayload,
      expectedPurpose
    );
  });

  it("should succeed when requester is Consumer Delegate", async () => {
    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      state: delegationState.active,
    });

    const delegatedDraftPurpose: Purpose = {
      ...draftPurpose,
      delegationId: consumerDelegation.id,
    };
    await addOnePurpose(delegatedDraftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneDelegation(consumerDelegation);
    await addOnePurposeTemplate(purposeTemplate);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "updated title",
      dailyCalls: 666,
      riskAnalysisForm: {
        version: "3.1",
        answers: {
          ...updatedSingleAnswersWithFreeText,
          ...updatedSingleAnswerFreeTextWithSuggestValue,
        },
      },
    };
    const updatePurpose = await purposeService.patchUpdatePurposeFromTemplate(
      purposeTemplate.id,
      draftPurpose.id,
      updateContent,
      getMockContextM2MAdmin({
        organizationId: consumerDelegation.delegateId,
      })
    );

    const writtenPayload = await expectWrittenEventAndGetPayload(
      draftPurpose.id
    );

    const expectedPurpose: Purpose = sortPurpose({
      ...draftPurpose,
      delegationId: consumerDelegation.id,
      title: updateContent.title!,
      versions: [
        {
          createdAt: draftPurpose.versions[0].createdAt,
          dailyCalls: updateContent.dailyCalls!,
          firstActivationAt: draftPurpose.versions[0].firstActivationAt,
          id: draftPurpose.versions[0].id,
          riskAnalysis: draftPurpose.versions[0].riskAnalysis,
          state: draftPurpose.versions[0].state,
          updatedAt: new Date(),
          suspendedAt: draftPurpose.versions[0].suspendedAt,
          stamps: draftPurpose.versions[0].stamps,
        },
      ],
      riskAnalysisForm: {
        ...draftPurpose.riskAnalysisForm!,
        id: expect.any(String),
        multiAnswers: draftPurpose.riskAnalysisForm!.multiAnswers.map((a) => ({
          ...a,
          id: expect.any(String),
        })),
        singleAnswers: [
          ...draftPurpose
            .riskAnalysisForm!.singleAnswers.filter(
              (a) => a.key !== "ruleOfLawText"
            )
            .map((a) =>
              match(a.key)
                .with("legalBasisPublicInterest", () => ({
                  ...a,
                  id: expect.any(String),
                  value: legalBasisPublicInterest.legalBasisPublicInterest[0],
                }))
                .with("publicInterestTaskText", () => ({
                  ...a,
                  id: expect.any(String),
                  value:
                    updatedSingleAnswersWithFreeText.publicInterestTaskText[0],
                }))
                .with("legalObligationReference", () => ({
                  ...a,
                  id: expect.any(String),
                  value:
                    updatedSingleAnswerFreeTextWithSuggestValue
                      .legalObligationReference[0],
                }))
                .otherwise(() => ({ ...a, id: expect.any(String) }))
            ),
          {
            id: expect.any(String),
            key: "publicInterestTaskText",
            value: updatedSingleAnswersWithFreeText.publicInterestTaskText[0],
          },
        ],
      },
      updatedAt: new Date(),
    });

    await expectUpdatedPurpose(
      updatePurpose.data,
      writtenPayload,
      expectedPurpose
    );
  });

  it("Should throw purposeNotFound if the purpose not found", async () => {
    const invalidPurposeId: PurposeId = generateId();
    await addOnePurpose({ ...draftPurpose, id: invalidPurposeId });
    await addOnePurposeTemplate(purposeTemplate);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: draftPurpose.title,
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(purposeNotFound(draftPurpose.id));
  });

  it("Should throw purposeNotInDraftState if the purpose not in draft state", async () => {
    const nonDraftState: PurposeVersionState = getRandomNonPurposeStateWithout(
      purposeVersionState.draft
    );

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOnePurposeTemplate(purposeTemplate);
    await addOnePurpose({
      ...draftPurpose,
      versions: [
        {
          ...draftPurpose.versions[0],
          state: nonDraftState,
        },
      ],
    });

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      dailyCalls: 666,
    };

    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(purposeDraftVersionNotFound(draftPurpose.id));
  });

  it("Should throw purposeDraftVersionNotFound if there's a purpose version not in draft state", async () => {
    const nonDraftState: PurposeVersionState = getRandomNonPurposeStateWithout(
      purposeVersionState.draft
    );

    await addOnePurpose({
      ...draftPurpose,
      versions: [
        {
          ...draftPurpose.versions[0],
          state: purposeVersionState.active,
        },
        {
          ...draftPurpose.versions[0],
          id: generateId(),
          state: nonDraftState,
        },
      ],
    });

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: draftPurpose.title,
    };

    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(purposeDraftVersionNotFound(draftPurpose.id));
  });

  it("Should throw tenantIsNotTheConsumer if the tenant is not the consumer and is not delegated", async () => {
    await addOnePurpose(draftPurpose);
    await addOneTenant(consumer);

    const invalidConsumerId = generateId<TenantId>();
    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "updated title",
      dailyCalls: 666,
      riskAnalysisForm: {
        version: "3.1",
        answers: {
          ...updatedSingleAnswersWithFreeText,
          ...updatedSingleAnswerFreeTextWithSuggestValue,
        },
      },
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: invalidConsumerId,
        })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(invalidConsumerId));
  });

  it("Should throw purposeTemplateNotFound if the purpose template does not exist", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "updated title",
      dailyCalls: 666,
      riskAnalysisForm: {
        version: "3.1",
        answers: {
          ...updatedSingleAnswersWithFreeText,
          ...updatedSingleAnswerFreeTextWithSuggestValue,
        },
      },
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
  });

  it("Should throw duplicatedPurposeTitle if the purpose title already exists", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOnePurposeTemplate(purposeTemplate);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: draftPurpose.title,
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(duplicatedPurposeTitle(draftPurpose.title));
  });

  it("Should throw tenantIsNotTheConsumer if the tenant is not operating as consumer", async () => {
    await addOnePurpose(draftPurpose);
    await addOnePurposeTemplate(purposeTemplate);

    const invalidTenantId = generateId<TenantId>();
    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: draftPurpose.title,
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: invalidTenantId,
        })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(invalidTenantId));
  });

  it("Should throw eserviceNotFound if the eService does not exist", async () => {
    const invalidEServiceId = generateId<EServiceId>();
    await addOnePurposeTemplate(purposeTemplate);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOnePurpose({
      ...draftPurpose,
      eserviceId: invalidEServiceId,
    });

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "New Title",
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(eserviceNotFound(invalidEServiceId));
  });

  it("should throw riskAnalysisVersionMismatch if provided version of risk analysis is different", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOnePurposeTemplate(purposeTemplate);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "updated title",
      dailyCalls: 666,
      riskAnalysisForm: {
        version: "2.0",
        answers: {
          ...updatedSingleAnswersWithFreeText,
          ...updatedSingleAnswerFreeTextWithSuggestValue,
        },
      },
    };

    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(riskAnalysisVersionMismatch("2.0", "3.1"));
  });

  it("Should throw riskAnalysisMissingExpectedFieldError if a required field is missing", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOnePurposeTemplate(purposeTemplate);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "updated title",
      dailyCalls: 666,
      riskAnalysisForm: {
        version: "3.1",
        answers: {
          ...updatedSingleAnswersWithFreeText,
        },
      },
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(
      riskAnalysisMissingExpectedFieldError("legalObligationReference")
    );
  });

  it("Should throw riskAnalysisContainsNotEditableAnswers if a required field is missing", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOnePurposeTemplate(purposeTemplate);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "updated title",
      dailyCalls: 666,
      riskAnalysisForm: {
        version: "3.1",
        answers: {
          ...updatedSingleAnswersWithFreeText,
          ...updatedSingleAnswerFreeTextWithSuggestValue,
          purpose: ["not editable field"],
        },
      },
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(
      riskAnalysisContainsNotEditableAnswers(purposeTemplate.id, "purpose")
    );
  });
  it("Should throw riskAnalysisAnswerNotInSuggestValues provide invalid suggested value", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOnePurposeTemplate(purposeTemplate);

    const updateContent: purposeApi.PatchPurposeUpdateFromTemplateContent = {
      title: "updated title",
      dailyCalls: 666,
      riskAnalysisForm: {
        version: "3.1",
        answers: {
          ...updatedSingleAnswersWithFreeText,
          legalObligationReference: ["invalid suggested value"],
        },
      },
    };
    expect(
      purposeService.patchUpdatePurposeFromTemplate(
        purposeTemplate.id,
        draftPurpose.id,
        updateContent,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(
      riskAnalysisAnswerNotInSuggestValues(
        purposeTemplate.id,
        "legalObligationReference"
      )
    );
  });
});
