/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  purposeApi,
  catalogApi,
  tenantApi,
  agreementApi,
} from "pagopa-interop-api-clients";
import { UIAuthData, userRole } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockedApiEserviceDescriptor,
  getMockedApiPurposeVersion,
} from "pagopa-interop-commons-test";
import { generateId, PurposeId, TenantId, UserId } from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  PagoPAInteropBeClients,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { purposeServiceBuilder } from "../src/services/purposeService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getPurpose — reviewer enrichment", () => {
  const consumerId = generateId<TenantId>();
  const producerId = generateId<TenantId>();
  const reviewerId = generateId<UserId>();
  const sentToReviewerAt = new Date().toISOString();
  const consumerSelfcareId = generateId();

  const descriptor = getMockedApiEserviceDescriptor({
    state: catalogApi.EServiceDescriptorState.Values.PUBLISHED,
  });

  const eservice: catalogApi.EService = {
    id: generateId(),
    name: "eservice",
    producerId,
    description: "desc",
    technology: catalogApi.EServiceTechnology.Values.REST,
    descriptors: [descriptor],
    riskAnalysis: [],
    mode: catalogApi.EServiceMode.Values.DELIVER,
    isSignalHubEnabled: false,
    isConsumerDelegable: false,
    isClientAccessDelegable: false,
  };

  const consumer: tenantApi.Tenant = {
    id: consumerId,
    selfcareId: consumerSelfcareId,
    name: "consumer",
    attributes: [],
    externalId: { origin: "IPA", value: "123" },
    createdAt: new Date().toISOString(),
    kind: "GSP",
    mails: [],
    features: [],
  };

  const producer: tenantApi.Tenant = {
    id: producerId,
    name: "producer",
    attributes: [],
    externalId: { origin: "IPA", value: "456" },
    createdAt: new Date().toISOString(),
    kind: "GSP",
    mails: [],
    features: [],
  };

  const agreement: agreementApi.Agreement = {
    id: generateId(),
    eserviceId: eservice.id,
    descriptorId: descriptor.id,
    producerId,
    consumerId,
    state: agreementApi.AgreementState.Values.ACTIVE,
    verifiedAttributes: [],
    certifiedAttributes: [],
    certifiedDiscreteAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    stamps: {},
    createdAt: new Date().toISOString(),
  };

  const mockPurposeId = generateId<PurposeId>();
  const purposeMetadata = { version: 1 };
  const basePurpose: purposeApi.Purpose = {
    id: mockPurposeId,
    eserviceId: eservice.id,
    consumerId,
    title: "purpose",
    description: "desc",
    isFreeOfCharge: false,
    createdAt: new Date().toISOString(),
    versions: [],
    riskAnalysisReviewMode:
      purposeApi.RiskAnalysisReviewMode.Values.REVIEWER_WRITES_REVIEWER_SIGNS,
    reviewerWorkflow: {
      reviewers: [{ id: reviewerId, sentToReviewerAt }],
      signingState: purposeApi.RiskAnalysisSigningState.Values.ASSIGNED,
    },
  };

  const mockGetPurpose = vi.fn();
  const mockGetPurposes = vi.fn();
  const mockGetEServiceById = vi.fn();
  const mockGetTenant = vi.fn();
  const mockGetAgreements = vi.fn();
  const mockGetUserInfoUsingGET = vi.fn();

  const mockTenantProcessClient = {
    tenant: { getTenant: mockGetTenant },
  } as unknown as TenantProcessClient;

  const mockAuthorizationClient = {
    client: { getClientsWithKeys: vi.fn().mockResolvedValue({ results: [] }) },
  } as unknown as AuthorizationProcessClient;

  const mockDelegationProcessClient = {
    delegation: {},
  } as unknown as DelegationProcessClient;

  const purposeService = purposeServiceBuilder(
    {
      purposeProcessClient: { getPurposes: mockGetPurposes },
      purposeProcessClientWithMetadata: { getPurpose: mockGetPurpose },
      purposeTemplateProcessClient: { getPurposeTemplate: vi.fn() },
      catalogProcessClient: { getEServiceById: mockGetEServiceById },
      tenantProcessClient: mockTenantProcessClient,
      agreementProcessClient: { getAgreements: mockGetAgreements },
      authorizationClient: mockAuthorizationClient,
      delegationProcessClient: mockDelegationProcessClient,
      selfcareV2UserClient: { getUserInfoUsingGET: mockGetUserInfoUsingGET },
      inAppNotificationManagerClient: {
        filterUnreadNotifications: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PagoPAInteropBeClients,
    fileManager
  );

  beforeEach(() => {
    mockGetPurpose.mockReset();
    mockGetPurposes.mockReset();
    mockGetEServiceById.mockReset();
    mockGetAgreements.mockReset();
    mockGetUserInfoUsingGET.mockReset();

    mockGetPurpose.mockResolvedValue({
      data: basePurpose,
      metadata: purposeMetadata,
    });
    mockGetEServiceById.mockResolvedValue(eservice);
    mockGetTenant.mockImplementation(
      ({ params }: { params: { id: string } }) =>
        params.id === consumerId ? consumer : producer
    );
    mockGetAgreements.mockResolvedValue({ results: [agreement] });
  });

  it.each([userRole.ADMIN_ROLE, userRole.VIEWER_ROLE, userRole.REVIEWER_ROLE])(
    "should enrich reviewerWorkflow with reviewers for a consumer with role %s",
    async (role) => {
      const mockUserInfo = { id: reviewerId, name: "Name", surname: "Surname" };
      mockGetUserInfoUsingGET.mockResolvedValue(mockUserInfo);

      const authData: UIAuthData = {
        ...getMockAuthData(undefined, undefined, [role]),
        organizationId: consumerId,
      };
      const ctx = getBffMockContext(getMockContext({ authData }));

      const result = await purposeService.getPurpose(mockPurposeId, ctx);

      expect(result.data.reviewerWorkflow?.reviewers).toEqual([
        {
          userId: reviewerId,
          name: "Name",
          familyName: "Surname",
          sentToReviewerAt,
        },
      ]);
      expect(result.metadata).toEqual(purposeMetadata);
      expect(mockGetUserInfoUsingGET).toHaveBeenCalledOnce();
      expect(mockGetUserInfoUsingGET).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: reviewerId } })
      );
    }
  );

  it.each([userRole.SECURITY_ROLE, userRole.ADMIN_ROLE, userRole.VIEWER_ROLE])(
    "should NOT include reviewers in reviewerWorkflow when requester is the producer (role: %s)",
    async (role) => {
      const authData: UIAuthData = {
        ...getMockAuthData(undefined, undefined, [role]),
        organizationId: producerId,
      };
      const ctx = getBffMockContext(getMockContext({ authData }));

      const result = await purposeService.getPurpose(mockPurposeId, ctx);

      expect(result.data.reviewerWorkflow?.reviewers).toBeUndefined();
      expect(mockGetUserInfoUsingGET).not.toHaveBeenCalled();
    }
  );

  it.each(
    Object.values(userRole).filter(
      (role) =>
        role !== userRole.ADMIN_ROLE &&
        role !== userRole.VIEWER_ROLE &&
        role !== userRole.REVIEWER_ROLE
    )
  )(
    "should NOT include reviewers when requester is the consumer with role: %s",
    async (role) => {
      const authData: UIAuthData = {
        ...getMockAuthData(undefined, undefined, [role]),
        organizationId: consumerId,
      };
      const ctx = getBffMockContext(getMockContext({ authData }));

      const result = await purposeService.getPurpose(mockPurposeId, ctx);

      expect(result.data.reviewerWorkflow?.reviewers).toBeUndefined();
      expect(mockGetUserInfoUsingGET).not.toHaveBeenCalled();
    }
  );

  it("should return empty reviewers array when there are no reviewers (consumer)", async () => {
    mockGetPurpose.mockResolvedValue({
      data: {
        ...basePurpose,
        reviewerWorkflow: {
          ...basePurpose.reviewerWorkflow!,
          reviewers: [],
        },
      },
      metadata: purposeMetadata,
    });

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: consumerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));

    const result = await purposeService.getPurpose(mockPurposeId, ctx);

    expect(result.data.reviewerWorkflow?.reviewers).toEqual([]);
    expect(mockGetUserInfoUsingGET).not.toHaveBeenCalled();
  });

  it("should return undefined reviewerWorkflow when purpose has no reviewerWorkflow", async () => {
    mockGetPurpose.mockResolvedValue({
      data: {
        ...basePurpose,
        reviewerWorkflow: undefined,
      },
      metadata: purposeMetadata,
    });

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: consumerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));

    const result = await purposeService.getPurpose(mockPurposeId, ctx);

    expect(result.data.reviewerWorkflow).toBeUndefined();
    expect(mockGetUserInfoUsingGET).not.toHaveBeenCalled();
  });

  describe("consumer-suspended purpose version normalization", () => {
    const currentVersion: purposeApi.PurposeVersion = {
      ...getMockedApiPurposeVersion({
        state: purposeApi.PurposeVersionState.Values.SUSPENDED,
      }),
      createdAt: "2026-09-01T00:00:00.000Z",
      dailyCalls: 100,
      signedContract: {
        id: generateId(),
        contentType: "application/pdf",
        path: "signed-contract.pdf",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    };
    const waitingForApprovalVersion: purposeApi.PurposeVersion = {
      ...getMockedApiPurposeVersion({
        state: purposeApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL,
      }),
      createdAt: "2026-09-02T00:00:00.000Z",
      dailyCalls: currentVersion.dailyCalls,
    };
    const expectedWaitingVersion = {
      id: waitingForApprovalVersion.id,
      state: waitingForApprovalVersion.state,
      createdAt: waitingForApprovalVersion.createdAt,
      dailyCalls: waitingForApprovalVersion.dailyCalls,
    };
    const purpose: purposeApi.Purpose = {
      ...basePurpose,
      versions: [currentVersion, waitingForApprovalVersion],
      suspendedByConsumer: true,
      reviewerWorkflow: undefined,
    };

    beforeEach(() => {
      mockGetPurpose.mockResolvedValue({
        data: purpose,
        metadata: purposeMetadata,
      });
      mockGetPurposes.mockResolvedValue({
        results: [purpose],
        totalCount: 1,
      });
    });

    it.each([false, true])(
      "omits currentVersion from details when dailyCalls match (suspendedByProducer: %s), preserving metadata and version history",
      async (suspendedByProducer) => {
        mockGetPurpose.mockResolvedValue({
          data: { ...purpose, suspendedByProducer },
          metadata: purposeMetadata,
        });
        const ctx = getBffMockContext(
          getMockContext({
            authData: { ...getMockAuthData(), organizationId: producerId },
          })
        );

        const result = await purposeService.getPurpose(mockPurposeId, ctx);

        expect(result.data.currentVersion).toBeUndefined();
        expect(result.data).toMatchObject({
          waitingForApprovalVersion: expectedWaitingVersion,
          versions: [
            {
              id: currentVersion.id,
              state: currentVersion.state,
              dailyCalls: currentVersion.dailyCalls,
            },
            expectedWaitingVersion,
          ],
          suspendedByConsumer: true,
          suspendedByProducer,
          isDocumentReady: true,
        });
        expect(result.metadata).toEqual(purposeMetadata);
      }
    );

    it.each([
      {
        name: "consumer purposes",
        retrieve: purposeService.getConsumerPurposes,
        organizationId: consumerId,
      },
      {
        name: "producer purposes",
        retrieve: purposeService.getProducerPurposes,
        organizationId: producerId,
      },
      {
        name: "risk analysis assignments",
        retrieve: purposeService.getRiskAnalysisAssignments,
        organizationId: consumerId,
      },
    ])(
      "normalizes matching dailyCalls in $name and retains currentVersion for a dailyCalls change",
      async ({ retrieve, organizationId }) => {
        const increasedWaitingVersion = {
          ...waitingForApprovalVersion,
          dailyCalls: currentVersion.dailyCalls + 1,
        };
        const purposeWithIncreasedDailyCalls = {
          ...purpose,
          id: generateId<PurposeId>(),
          versions: [currentVersion, increasedWaitingVersion],
        };
        mockGetPurposes.mockResolvedValue({
          results: [purpose, purposeWithIncreasedDailyCalls],
          totalCount: 2,
        });
        const ctx = getBffMockContext(
          getMockContext({
            authData: { ...getMockAuthData(), organizationId },
          })
        );

        const result = await retrieve({}, 0, 10, ctx);

        expect(result.results[0]?.currentVersion).toBeUndefined();
        expect(result.results[0]?.waitingForApprovalVersion).toMatchObject(
          expectedWaitingVersion
        );
        expect(result.results[0]?.versions).toHaveLength(2);
        expect(result.results[1]?.currentVersion).toMatchObject({
          id: currentVersion.id,
          state: currentVersion.state,
          dailyCalls: currentVersion.dailyCalls,
        });
        expect(result.results[1]?.waitingForApprovalVersion).toMatchObject({
          ...expectedWaitingVersion,
          dailyCalls: increasedWaitingVersion.dailyCalls,
        });
        expect(result.pagination).toEqual({
          offset: 0,
          limit: 10,
          totalCount: 2,
        });
      }
    );

    it.each([
      {
        name: "dailyCalls differ",
        versions: [
          currentVersion,
          {
            ...waitingForApprovalVersion,
            dailyCalls: currentVersion.dailyCalls + 1,
          },
        ],
        suspendedByConsumer: true,
      },
      {
        name: "only the producer suspended the purpose",
        versions: purpose.versions,
        suspendedByConsumer: false,
      },
      {
        name: "suspendedByConsumer is absent",
        versions: purpose.versions,
        suspendedByConsumer: undefined,
      },
      {
        name: "there is no waiting-for-approval version",
        versions: [currentVersion],
        suspendedByConsumer: true,
      },
    ])(
      "retains currentVersion in details when $name",
      async ({ versions, suspendedByConsumer }) => {
        mockGetPurpose.mockResolvedValue({
          data: {
            ...purpose,
            versions,
            suspendedByConsumer,
            suspendedByProducer: true,
          },
          metadata: purposeMetadata,
        });
        const ctx = getBffMockContext(
          getMockContext({
            authData: { ...getMockAuthData(), organizationId: producerId },
          })
        );

        const result = await purposeService.getPurpose(mockPurposeId, ctx);

        expect(result.data.currentVersion).toMatchObject({
          id: currentVersion.id,
          state: currentVersion.state,
          dailyCalls: currentVersion.dailyCalls,
        });
      }
    );

    it("retains the waiting-for-approval version when there is no current version", async () => {
      mockGetPurpose.mockResolvedValue({
        data: { ...purpose, versions: [waitingForApprovalVersion] },
        metadata: purposeMetadata,
      });
      const ctx = getBffMockContext(
        getMockContext({
          authData: { ...getMockAuthData(), organizationId: producerId },
        })
      );

      const result = await purposeService.getPurpose(mockPurposeId, ctx);

      expect(result.data.currentVersion).toBeUndefined();
      expect(result.data.waitingForApprovalVersion).toMatchObject(
        expectedWaitingVersion
      );
    });
  });
});
