/* eslint-disable @typescript-eslint/no-floating-promises */
import { rulesVersionNotFoundError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockValidRiskAnalysisForm,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  PurposeId,
  PurposeRiskAnalysisFormEditedV2,
  Tenant,
  TenantId,
  UserId,
  eventConflictError,
  fromPurposeV2,
  generateId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import {
  editNotAllowedForReviewMode,
  purposeNotFound,
  requesterIsNotDesignatedReviewer,
  reviewerWorkflowNotEditable,
  reviewerWorkflowNotFound,
  riskAnalysisValidationFailed,
  riskAnalysisAlreadyApproved,
  riskAnalysisAlreadyRejected,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
  postgresDB,
  readLastPurposeEvent,
} from "../integrationUtils.js";
import { buildRiskAnalysisFormSeed } from "../mockUtils.js";

describe("editRiskAnalysisForm", () => {
  const mockTenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const mockEService: EService = {
    ...getMockEService(),
  };

  it("should write PurposeRiskAnalysisFormEdited on event-store", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisReviewMode:
        riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.assigned,
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    const { data: updatedPurpose } = await purposeService.editRiskAnalysisForm(
      mockPurpose.id,
      riskAnalysisFormSeed,
      getMockContext({
        authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
      })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisFormEdited",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisFormEditedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(fromPurposeV2(writtenPayload.purpose!))).toEqual(
      sortPurpose(updatedPurpose)
    );

    vi.useRealTimers();
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();
    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        randomId,
        riskAnalysisFormSeed,
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });

  it("should throw reviewerWorkflowNotFound if the purpose has no reviewer workflow", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewerWorkflow: undefined,
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotFound(mockPurpose.id));
  });

  it("should throw editNotAllowedForReviewMode if the workflow mode is AdminWritesReviewerSigns", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId }],
        signingState: riskAnalysisSigningState.draft,
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(editNotAllowedForReviewMode(mockPurpose.id));
  });

  it.each([
    {
      signingState: riskAnalysisSigningState.submitted,
      expectedError: reviewerWorkflowNotEditable,
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    },
    {
      signingState: riskAnalysisSigningState.signed,
      expectedError: riskAnalysisAlreadyApproved,
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    },
    {
      signingState: riskAnalysisSigningState.rejected,
      expectedError: riskAnalysisAlreadyRejected,
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    },
    {
      signingState: riskAnalysisSigningState.signed,
      expectedError: riskAnalysisAlreadyApproved,
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    },
    {
      signingState: riskAnalysisSigningState.rejected,
      expectedError: riskAnalysisAlreadyRejected,
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    },
  ])(
    "should report the corresponding conflict for state $signingState in $reviewMode mode",
    async ({ signingState, expectedError, reviewMode }) => {
      const reviewerId: UserId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        consumerId: mockTenant.id,
        eserviceId: mockEService.id,
        riskAnalysisReviewMode: reviewMode,
        reviewerWorkflow: {
          reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
          signingState,
          signedBy: reviewerId,
        },
      };

      await addOneTenant(mockTenant);
      await addOneEService(mockEService);
      await addOnePurpose(mockPurpose);

      const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
        getMockValidRiskAnalysisForm(tenantKind.PA)
      );

      await expect(
        purposeService.editRiskAnalysisForm(
          mockPurpose.id,
          riskAnalysisFormSeed,
          getMockContext({
            authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
          })
        )
      ).rejects.toThrowError(expectedError(mockPurpose.id));

      expect(await readLastPurposeEvent(mockPurpose.id)).toMatchObject({
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

  it.each([
    riskAnalysisSigningState.assigned,
    riskAnalysisSigningState.signed,
    riskAnalysisSigningState.rejected,
  ])(
    "should check the consumer before workflow state %s",
    async (signingState) => {
      const reviewerId: UserId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        consumerId: mockTenant.id,
        eserviceId: mockEService.id,
        riskAnalysisReviewMode:
          riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerWorkflow: {
          reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
          signingState,
        },
      };

      await addOneTenant(mockTenant);
      await addOneEService(mockEService);
      await addOnePurpose(mockPurpose);

      const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
        getMockValidRiskAnalysisForm(tenantKind.PA)
      );

      const otherOrganizationId = generateId<TenantId>();

      await expect(
        purposeService.editRiskAnalysisForm(
          mockPurpose.id,
          riskAnalysisFormSeed,
          getMockContext({
            authData: getMockAuthData(otherOrganizationId, reviewerId),
          })
        )
      ).rejects.toThrowError(tenantIsNotTheConsumer(otherOrganizationId));

      expect(await readLastPurposeEvent(mockPurpose.id)).toMatchObject({
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

  it("should throw requesterIsNotDesignatedReviewer if the requester is not in reviewerIds", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisReviewMode:
        riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: generateId<UserId>(), sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.assigned,
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({
          authData: getMockAuthData(
            mockPurpose.consumerId,
            generateId<UserId>()
          ),
        })
      )
    ).rejects.toThrowError(requesterIsNotDesignatedReviewer(mockPurpose.id));
  });

  it("should throw riskAnalysisValidationFailed if the risk analysis is not valid", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisReviewMode:
        riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.assigned,
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const invalidRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      version: "0",
    };

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      invalidRiskAnalysisForm
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        rulesVersionNotFoundError(mockTenant.kind!, "0"),
      ])
    );
  });

  it("should propagate an event-store conflict without writing another event", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisReviewMode:
        riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.assigned,
      },
    };
    const context = getMockContext({
      authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
    });
    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);
    await purposeService.editRiskAnalysisForm(
      mockPurpose.id,
      riskAnalysisFormSeed,
      context
    );
    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    // The readmodel still has version 0 after the first event-store write.
    const writeTransaction = vi.spyOn(postgresDB, "tx");
    try {
      await expect(
        purposeService.editRiskAnalysisForm(
          mockPurpose.id,
          riskAnalysisFormSeed,
          context
        )
      ).rejects.toThrowError(
        eventConflictError(context.correlationId, mockPurpose.id, 0)
      );
      expect(writeTransaction).toHaveBeenCalledOnce();
    } finally {
      writeTransaction.mockRestore();
    }

    expect(await readLastPurposeEvent(mockPurpose.id)).toEqual(writtenEvent);
  });
});
