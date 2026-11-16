/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockEService,
  getMockExpiredRiskAnalysisForm,
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
  PurposeRiskAnalysisSignedV2,
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
  missingRiskAnalysis,
  purposeMetadataVersionMismatch,
  purposeNotFound,
  requesterIsNotDesignatedReviewer,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotInSignableState,
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

describe("signRiskAnalysis", () => {
  const mockTenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const mockEService: EService = {
    ...getMockEService(),
  };

  const signableWorkflows = [
    {
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.submitted,
    },
    {
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      signingState: riskAnalysisSigningState.assigned,
    },
  ];

  it("should write PurposeRiskAnalysisSigned on event-store for ReviewerWritesReviewerSigns mode", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
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

    const { data: updatedPurpose } = await purposeService.signRiskAnalysis(
      mockPurpose.id,
      { metadataVersionToSign: 0 },
      getMockContext({
        authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
      })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisSigned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisSignedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(fromPurposeV2(writtenPayload.purpose!))).toEqual(
      sortPurpose(updatedPurpose)
    );

    vi.useRealTimers();
  });

  it("should write PurposeRiskAnalysisSigned on event-store for AdminWritesReviewerSigns mode", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.submitted,
      },
    };

    await addOnePurpose(mockPurpose);

    const { data: updatedPurpose } = await purposeService.signRiskAnalysis(
      mockPurpose.id,
      { metadataVersionToSign: 0 },
      getMockContext({
        authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
      })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisSigned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisSignedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(fromPurposeV2(writtenPayload.purpose!))).toEqual(
      sortPurpose(updatedPurpose)
    );

    expect(updatedPurpose.reviewerWorkflow?.signedBy).toEqual(reviewerId);
    expect(updatedPurpose.reviewerWorkflow?.signedAt).toEqual(new Date());

    vi.useRealTimers();
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();

    expect(
      purposeService.signRiskAnalysis(
        randomId,
        { metadataVersionToSign: 0 },
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });

  it("should throw reviewerWorkflowNotFound if the purpose has no reviewer workflow", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: undefined,
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.signRiskAnalysis(
        mockPurpose.id,
        { metadataVersionToSign: 0 },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotFound(mockPurpose.id));
  });

  it.each(signableWorkflows)(
    "should throw reviewerWorkflowNotInSignableState for a draft in $reviewMode mode",
    async ({ reviewMode }) => {
      const reviewerId: UserId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        riskAnalysisReviewMode: reviewMode,
        reviewerWorkflow: {
          reviewers: [{ id: reviewerId, sentToReviewerAt: undefined }],
          signingState: riskAnalysisSigningState.draft,
        },
      };

      await addOnePurpose(mockPurpose);

      await expect(
        purposeService.signRiskAnalysis(
          mockPurpose.id,
          { metadataVersionToSign: 0 },
          getMockContext({
            authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
          })
        )
      ).rejects.toThrowError(
        reviewerWorkflowNotInSignableState(mockPurpose.id)
      );

      expect(await readLastPurposeEvent(mockPurpose.id)).toMatchObject({
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

  it.each(signableWorkflows)(
    "should throw requesterIsNotDesignatedReviewer in $reviewMode mode",
    async ({ reviewMode, signingState }) => {
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        riskAnalysisReviewMode: reviewMode,
        reviewerWorkflow: {
          reviewers: [
            { id: generateId<UserId>(), sentToReviewerAt: new Date() },
          ],
          signingState,
        },
      };

      await addOnePurpose(mockPurpose);

      await expect(
        purposeService.signRiskAnalysis(
          mockPurpose.id,
          { metadataVersionToSign: 0 },
          getMockContext({
            authData: getMockAuthData(
              mockPurpose.consumerId,
              generateId<UserId>()
            ),
          })
        )
      ).rejects.toThrowError(requesterIsNotDesignatedReviewer(mockPurpose.id));

      expect(await readLastPurposeEvent(mockPurpose.id)).toMatchObject({
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

  it("should throw missingRiskAnalysis for ReviewerWritesReviewerSigns if the form is missing", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      riskAnalysisReviewMode:
        riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.assigned,
      },
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.signRiskAnalysis(
        mockPurpose.id,
        { metadataVersionToSign: 0 },
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(missingRiskAnalysis(mockPurpose.id));
  });

  it("should throw riskAnalysisValidationFailed for ReviewerWritesReviewerSigns if the form is invalid", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockExpiredRiskAnalysisForm(tenantKind.PA),
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

    await expect(
      purposeService.signRiskAnalysis(
        mockPurpose.id,
        { metadataVersionToSign: 0 },
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toMatchObject({ code: "riskAnalysisValidationFailed" });
  });

  it.each(signableWorkflows)(
    "should block signing if metadata changed in $reviewMode mode",
    async ({ reviewMode, signingState }) => {
      const reviewerId: UserId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        riskAnalysisReviewMode: reviewMode,
        reviewerWorkflow: {
          reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
          signingState,
        },
      };

      await addOnePurpose(mockPurpose);

      await expect(
        purposeService.signRiskAnalysis(
          mockPurpose.id,
          { metadataVersionToSign: 1 },
          getMockContext({
            authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
          })
        )
      ).rejects.toThrowError(
        purposeMetadataVersionMismatch(mockPurpose.id, 1, 0)
      );

      const writtenEvent = await readLastPurposeEvent(mockPurpose.id);
      expect(writtenEvent).toMatchObject({
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

  describe.each(signableWorkflows)(
    "terminal conflicts in $reviewMode mode",
    ({ reviewMode }) => {
      it.each([
        {
          signingState: riskAnalysisSigningState.signed,
          expectedError: riskAnalysisAlreadyApproved,
        },
        {
          signingState: riskAnalysisSigningState.rejected,
          expectedError: riskAnalysisAlreadyRejected,
        },
      ])(
        "should report $signingState before checking a stale metadata version",
        async ({ signingState, expectedError }) => {
          const reviewerId: UserId = generateId();
          const mockPurpose: Purpose = {
            ...getMockPurpose([getMockPurposeVersion()]),
            riskAnalysisReviewMode: reviewMode,
            reviewerWorkflow: {
              reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
              signingState,
            },
          };

          await addOnePurpose(mockPurpose);

          await expect(
            purposeService.signRiskAnalysis(
              mockPurpose.id,
              { metadataVersionToSign: 1 },
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

      it("should check the consumer before reporting a terminal conflict", async () => {
        const reviewerId: UserId = generateId();
        const mockPurpose: Purpose = {
          ...getMockPurpose([getMockPurposeVersion()]),
          riskAnalysisReviewMode: reviewMode,
          reviewerWorkflow: {
            reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
            signingState: riskAnalysisSigningState.signed,
          },
        };
        const otherOrganizationId = generateId<TenantId>();

        await addOnePurpose(mockPurpose);

        await expect(
          purposeService.signRiskAnalysis(
            mockPurpose.id,
            { metadataVersionToSign: 0 },
            getMockContext({
              authData: getMockAuthData(otherOrganizationId, reviewerId),
            })
          )
        ).rejects.toThrowError(tenantIsNotTheConsumer(otherOrganizationId));

        expect(await readLastPurposeEvent(mockPurpose.id)).toMatchObject({
          version: "0",
          type: "PurposeAdded",
        });
      });
    }
  );

  it("should propagate an event-store conflict without writing another event", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.submitted,
      },
    };
    const context = getMockContext({
      authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
    });

    await addOnePurpose(mockPurpose);
    await purposeService.signRiskAnalysis(
      mockPurpose.id,
      { metadataVersionToSign: 0 },
      context
    );
    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    // The readmodel still has version 0 after the first event-store write.
    const writeTransaction = vi.spyOn(postgresDB, "tx");
    try {
      await expect(
        purposeService.signRiskAnalysis(
          mockPurpose.id,
          { metadataVersionToSign: 0 },
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
