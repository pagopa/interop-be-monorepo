/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  purposeApi,
  purposeTemplateApi,
  catalogApi,
  tenantApi,
  agreementApi,
  attributeRegistryApi,
  eserviceTemplateApi,
  notificationConfigApi,
  inAppNotificationApi,
  SelfcareV2UsersClient,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";
import { generateId, PurposeId, TenantId, UserId } from "pagopa-interop-models";
import { UIAuthData } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { purposeServiceBuilder } from "../src/services/purposeService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getPurpose (service) — reviewer enrichment", () => {
  const consumerId = generateId<TenantId>();
  const producerId = generateId<TenantId>();
  const reviewerId = generateId<UserId>();
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
    declaredAttributes: [],
    consumerDocuments: [],
    stamps: {},
    createdAt: new Date().toISOString(),
  };

  const basePurposeId = generateId<PurposeId>();
  const basePurpose: purposeApi.Purpose = {
    id: basePurposeId,
    eserviceId: eservice.id,
    consumerId,
    title: "purpose",
    description: "desc",
    isFreeOfCharge: false,
    createdAt: new Date().toISOString(),
    versions: [],
    reviewerWorkflow: {
      reviewMode:
        purposeApi.RiskAnalysisReviewMode.Values.REVIEWER_WRITES_REVIEWER_SIGNS,
      reviewerIds: [reviewerId],
      signingState: purposeApi.RiskAnalysisSigningState.Values.ASSIGNED,
    },
  };

  const mockGetPurpose = vi.fn();
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
      purposeProcessClient: {
        getPurpose: mockGetPurpose,
      } as unknown as purposeApi.PurposeProcessClient,
      purposeTemplateProcessClient: {
        getPurposeTemplate: vi.fn(),
      } as unknown as purposeTemplateApi.PurposeTemplateProcessClient,
      catalogProcessClient: {
        getEServiceById: mockGetEServiceById,
      } as unknown as catalogApi.CatalogProcessClient,
      tenantProcessClient: mockTenantProcessClient,
      agreementProcessClient: {
        getAgreements: mockGetAgreements,
      } as unknown as agreementApi.AgreementProcessClient,
      authorizationClient: mockAuthorizationClient,
      delegationProcessClient: mockDelegationProcessClient,
      selfcareV2UserClient: {
        getUserInfoUsingGET: mockGetUserInfoUsingGET,
      } as unknown as SelfcareV2UsersClient,
      inAppNotificationManagerClient: {
        filterUnreadNotifications: vi.fn().mockResolvedValue([]),
      } as unknown as inAppNotificationApi.InAppNotificationManagerClient,
      selfcareV2InstitutionClient: {} as unknown as SelfcareV2InstitutionClient,
      attributeProcessClient:
        {} as unknown as attributeRegistryApi.AttributeProcessClient,
      eserviceTemplateProcessClient:
        {} as unknown as eserviceTemplateApi.EServiceTemplateProcessClient,
      notificationConfigProcessClient:
        {} as unknown as notificationConfigApi.NotificationConfigProcessClient,
    },
    fileManager
  );

  beforeEach(() => {
    mockGetPurpose.mockReset();
    mockGetEServiceById.mockReset();
    mockGetAgreements.mockReset();
    mockGetUserInfoUsingGET.mockReset();

    mockGetPurpose.mockResolvedValue(basePurpose);
    mockGetEServiceById.mockResolvedValue(eservice);
    mockGetTenant.mockImplementation(
      ({ params }: { params: { id: string } }) =>
        params.id === consumerId ? consumer : producer
    );
    mockGetAgreements.mockResolvedValue({ results: [agreement] });
  });

  it("should enrich reviewerWorkflow with reviewers when requester is the consumer", async () => {
    const mockUserInfo = { id: reviewerId, name: "Name", surname: "Surname" };
    mockGetUserInfoUsingGET.mockResolvedValue(mockUserInfo);

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: consumerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));

    const result = await purposeService.getPurpose(basePurpose.id, ctx);

    expect(result.reviewerWorkflow?.reviewers).toEqual([
      { userId: reviewerId, name: "Name", familyName: "Surname" },
    ]);
    expect(mockGetUserInfoUsingGET).toHaveBeenCalledOnce();
    expect(mockGetUserInfoUsingGET).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: reviewerId } })
    );
  });

  it("should NOT include reviewers in reviewerWorkflow when requester is the producer", async () => {
    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: producerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));

    const result = await purposeService.getPurpose(basePurpose.id, ctx);

    expect(result.reviewerWorkflow?.reviewers).toBeUndefined();
    expect(mockGetUserInfoUsingGET).not.toHaveBeenCalled();
  });

  it("should return empty reviewers array when reviewerIds is empty (consumer)", async () => {
    mockGetPurpose.mockResolvedValue({
      ...basePurpose,
      reviewerWorkflow: { ...basePurpose.reviewerWorkflow!, reviewerIds: [] },
    });

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: consumerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));

    const result = await purposeService.getPurpose(basePurpose.id, ctx);

    expect(result.reviewerWorkflow?.reviewers).toEqual([]);
    expect(mockGetUserInfoUsingGET).not.toHaveBeenCalled();
  });

  it("should return undefined reviewerWorkflow when purpose has no reviewerWorkflow", async () => {
    mockGetPurpose.mockResolvedValue({
      ...basePurpose,
      reviewerWorkflow: undefined,
    });

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: consumerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));

    const result = await purposeService.getPurpose(basePurpose.id, ctx);

    expect(result.reviewerWorkflow).toBeUndefined();
    expect(mockGetUserInfoUsingGET).not.toHaveBeenCalled();
  });
});
