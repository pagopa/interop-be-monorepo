/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import { DB, eventRepository } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  RiskAnalysisSigningState,
  UserId,
  eventConflictError,
  generateId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  tenantKind,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { purposeServiceBuilder } from "../../src/services/purposeService.js";
import { ReadModelServiceSQL } from "../../src/services/readModelServiceSQL.js";
import { buildRiskAnalysisFormSeed } from "../mockUtils.js";

vi.mock("pagopa-interop-commons", async (importOriginal) => ({
  ...(await importOriginal<typeof import("pagopa-interop-commons")>()),
  eventRepository: vi.fn(),
}));

const repository = {
  createEvent: vi.fn<ReturnType<typeof eventRepository>["createEvent"]>(),
  createEvents: vi.fn<ReturnType<typeof eventRepository>["createEvents"]>(),
};

const readModelService = {
  getPurposeById: vi.fn<ReadModelServiceSQL["getPurposeById"]>(),
  getEServiceById: vi.fn<ReadModelServiceSQL["getEServiceById"]>(),
  getTenantById: vi.fn<ReadModelServiceSQL["getTenantById"]>(),
  getPurpose: vi.fn(),
  getTenantKindAt: vi.fn(),
  getFirstTenantKind: vi.fn(),
  getPurposes: vi.fn(),
  getActiveAgreement: vi.fn(),
  getActiveVersionsDailyCalls: vi.fn(),
  getActiveProducerDelegationByEserviceId: vi.fn(),
  getActiveConsumerDelegationByEserviceAndConsumerIds: vi.fn(),
  getActiveConsumerDelegationByDelegationId: vi.fn(),
  getPublishedPurposeTemplateById: vi.fn(),
  getClientById: vi.fn(),
} satisfies ReadModelServiceSQL;

vi.mocked(eventRepository).mockReturnValue(repository);

// These dependencies are never used: the event repository and read model are local mocks.
const purposeService = purposeServiceBuilder(
  {} as DB,
  readModelService,
  {} as SelfcareV2InstitutionClient
);

const reviewerId = generateId<UserId>();
const form = getMockValidRiskAnalysisForm(tenantKind.PA);
const formSeed = buildRiskAnalysisFormSeed(form);
const metadataVersion = 4;
const contextFor = (purpose: Purpose) =>
  getMockContext({
    authData: getMockAuthData(purpose.consumerId, reviewerId),
  });

const operations = [
  {
    name: "sign in AdminWritesReviewerSigns mode",
    reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    initialState: riskAnalysisSigningState.submitted,
    invalidState: riskAnalysisSigningState.draft,
    invalidStateError: "reviewerWorkflowNotInSignableState",
    sign: true,
    execute: (purpose: Purpose) =>
      purposeService.signRiskAnalysis(
        purpose.id,
        { metadataVersionToSign: metadataVersion },
        contextFor(purpose)
      ),
  },
  {
    name: "sign in ReviewerWritesReviewerSigns mode",
    reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    initialState: riskAnalysisSigningState.assigned,
    invalidState: riskAnalysisSigningState.draft,
    invalidStateError: "reviewerWorkflowNotInSignableState",
    sign: true,
    execute: (purpose: Purpose) =>
      purposeService.signRiskAnalysis(
        purpose.id,
        { metadataVersionToSign: metadataVersion },
        contextFor(purpose)
      ),
  },
  {
    name: "reject",
    reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    initialState: riskAnalysisSigningState.submitted,
    invalidState: riskAnalysisSigningState.assigned,
    invalidStateError: "reviewerWorkflowNotInSubmittedState",
    sign: false,
    execute: (purpose: Purpose) =>
      purposeService.rejectRiskAnalysis(
        purpose.id,
        { rejectionReason: "The risk analysis needs revision" },
        contextFor(purpose)
      ),
  },
  {
    name: "edit form",
    reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    initialState: riskAnalysisSigningState.assigned,
    invalidState: riskAnalysisSigningState.submitted,
    invalidStateError: "reviewerWorkflowNotEditable",
    sign: false,
    execute: (purpose: Purpose) =>
      purposeService.editRiskAnalysisForm(
        purpose.id,
        formSeed,
        contextFor(purpose)
      ),
  },
];

const terminalStates = [
  {
    state: riskAnalysisSigningState.signed,
    code: "riskAnalysisAlreadyApproved",
  },
  {
    state: riskAnalysisSigningState.rejected,
    code: "riskAnalysisAlreadyRejected",
  },
];

describe.each(operations)("Risk analysis conflicts: $name", (operation) => {
  const purpose: Purpose = {
    ...getMockPurpose(),
    riskAnalysisForm: form,
    riskAnalysisReviewMode: operation.reviewMode,
    reviewerWorkflow: {
      reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
      signingState: operation.initialState,
    },
  };

  const withState = (signingState: RiskAnalysisSigningState): Purpose => ({
    ...purpose,
    reviewerWorkflow: {
      reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
      signingState,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repository.createEvent.mockReset();
    repository.createEvent.mockResolvedValue({
      streamId: purpose.id,
      newVersion: metadataVersion + 1,
    });
    readModelService.getPurposeById.mockReset();
    readModelService.getPurposeById.mockResolvedValue({
      data: purpose,
      metadata: { version: metadataVersion },
    });
    readModelService.getTenantById.mockResolvedValue({
      ...getMockTenant(purpose.consumerId),
      kind: tenantKind.PA,
    });
    readModelService.getEServiceById.mockResolvedValue(
      getMockEService(purpose.eserviceId)
    );
  });

  it.each(terminalStates)(
    "reports $code before a stale signing revision or other state validation",
    async ({ state, code }) => {
      readModelService.getPurposeById.mockResolvedValue({
        data: withState(state),
        metadata: { version: metadataVersion + 1 },
      });

      await expect(operation.execute(purpose)).rejects.toMatchObject({ code });
      expect(readModelService.getPurposeById).toHaveBeenCalledOnce();
      expect(repository.createEvent).not.toHaveBeenCalled();
    }
  );

  if (operation.name === "edit form") {
    it.each(terminalStates)(
      "reports $code before the edit review-mode guard",
      async ({ state, code }) => {
        readModelService.getPurposeById.mockResolvedValue({
          data: {
            ...withState(state),
            riskAnalysisReviewMode:
              riskAnalysisReviewMode.adminWritesReviewerSigns,
          },
          metadata: { version: metadataVersion },
        });

        await expect(operation.execute(purpose)).rejects.toMatchObject({
          code,
        });
        expect(repository.createEvent).not.toHaveBeenCalled();
      }
    );
  }

  it("preserves the consumer authorization guard before terminal errors", async () => {
    const otherConsumerPurpose = {
      ...withState(riskAnalysisSigningState.signed),
      consumerId: generateId<Purpose["consumerId"]>(),
    };
    readModelService.getPurposeById.mockResolvedValue({
      data: otherConsumerPurpose,
      metadata: { version: metadataVersion },
    });

    await expect(operation.execute(purpose)).rejects.toMatchObject({
      code: "tenantIsNotTheConsumer",
    });
    expect(repository.createEvent).not.toHaveBeenCalled();
  });

  it("preserves the generic error for a nonterminal invalid state", async () => {
    readModelService.getPurposeById.mockResolvedValue({
      data: withState(operation.invalidState),
      metadata: { version: metadataVersion },
    });

    await expect(operation.execute(purpose)).rejects.toMatchObject({
      code: operation.invalidStateError,
    });
    expect(repository.createEvent).not.toHaveBeenCalled();
  });

  it("preserves the designated reviewer authorization guard", async () => {
    readModelService.getPurposeById.mockResolvedValue({
      data: {
        ...purpose,
        reviewerWorkflow: {
          reviewers: [
            { id: generateId<UserId>(), sentToReviewerAt: new Date() },
          ],
          signingState: operation.initialState,
        },
      },
      metadata: { version: metadataVersion },
    });

    await expect(operation.execute(purpose)).rejects.toMatchObject({
      code: "requesterIsNotDesignatedReviewer",
    });
    expect(repository.createEvent).not.toHaveBeenCalled();
  });

  it.each([
    new Error("repository unavailable"),
    { code: "eventConflictError" },
    eventConflictError(),
  ])(
    "propagates write errors unchanged without rereading: %s",
    async (error) => {
      repository.createEvent.mockRejectedValue(error);

      await expect(operation.execute(purpose)).rejects.toBe(error);
      expect(readModelService.getPurposeById).toHaveBeenCalledOnce();
      expect(repository.createEvent).toHaveBeenCalledOnce();
    }
  );

  if (operation.sign) {
    it("reports a known metadata change before writing", async () => {
      readModelService.getPurposeById.mockResolvedValue({
        data: purpose,
        metadata: { version: metadataVersion + 1 },
      });

      await expect(operation.execute(purpose)).rejects.toMatchObject({
        code: "purposeMetadataVersionMismatch",
        title: "Purpose metadata version mismatch",
      });
      expect(repository.createEvent).not.toHaveBeenCalled();
      expect(readModelService.getPurposeById).toHaveBeenCalledOnce();
    });
  }
});
