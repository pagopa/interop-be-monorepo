import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attributeRegistryApi,
  authorizationApi,
  catalogApi,
  agreementApi,
  eserviceTemplateApi,
  inAppNotificationApi,
  delegationApi,
} from "pagopa-interop-api-clients";
import {
  DescriptorId,
  EServiceId,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { config } from "../src/config/config.js";
import { fileManager, getBffMockContext } from "./utils.js";
import { getMockDelegationApiDelegation } from "./mockUtils.js";

describe("getProducerEServiceDescriptor", () => {
  const tenantId: TenantId = generateId<TenantId>();
  const delegateId: TenantId = generateId<TenantId>();
  const eServiceId: EServiceId = generateId<EServiceId>();
  const descriptorId: DescriptorId = generateId<DescriptorId>();

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: tenantId,
  };
  const bffMockContext = getBffMockContext(getMockContext({ authData }));
  const delegateAuthData: AuthData = {
    ...getMockAuthData(),
    organizationId: delegateId,
  };
  const delegateBffMockContext = getBffMockContext(
    getMockContext({ authData: delegateAuthData })
  );

  const descriptor: catalogApi.EServiceDescriptor = {
    id: descriptorId,
    state: catalogApi.EServiceDescriptorState.Values.PUBLISHED,
    attributes: {
      declared: [],
      certified: [],
      verified: [],
    },
    version: "1",
    serverUrls: [],
    audience: [],
    voucherLifespan: 60,
    dailyCallsPerConsumer: 1,
    dailyCallsTotal: 1,
    docs: [],
    agreementApprovalPolicy:
      catalogApi.AgreementApprovalPolicy.Values.AUTOMATIC,
  };

  const eService: catalogApi.EService = {
    id: eServiceId,
    name: "mockEService",
    producerId: tenantId,
    description: "mockDescription",
    technology: catalogApi.EServiceTechnology.Values.REST,
    descriptors: [descriptor],
    mode: catalogApi.EServiceMode.Values.RECEIVE,
    riskAnalysis: [],
  };

  const mockCatalogProcessClient = {
    getEServiceById: vi.fn().mockResolvedValue(eService),
  } as unknown as catalogApi.CatalogProcessClient;

  const mockTenantProcessClient = {
    tenant: {
      getTenant: vi.fn(({ params: { id } }) => ({
        id,
        name: id === delegateId ? "mockDelegate" : "mockTenant",
        attributes: [],
        mails: [],
      })),
    },
  } as unknown as TenantProcessClient;

  const mockAgreementProcessClient =
    {} as unknown as agreementApi.AgreementProcessClient;

  const mockAttributeProcessClient = {
    getBulkedAttributes: vi.fn().mockResolvedValue({
      results: [],
      totalCount: 0,
    }),
  } as unknown as attributeRegistryApi.AttributeProcessClient;

  const mockProducerKeychains = vi.fn();
  const mockGetDelegations = vi.fn();

  const mockAuthorizationClient = {
    producerKeychain: {
      getProducerKeychains: mockProducerKeychains,
    },
  } as unknown as AuthorizationProcessClient;

  const mockDelegationProcessClient = {
    delegation: {
      getDelegations: mockGetDelegations,
    },
  } as unknown as DelegationProcessClient;

  const mockEServiceTemplateProcessClient =
    {} as unknown as eserviceTemplateApi.EServiceTemplateProcessClient;
  const mockInAppNotificationManagerClient =
    {} as unknown as inAppNotificationApi.InAppNotificationManagerClient;

  const catalogService = catalogServiceBuilder(
    mockCatalogProcessClient,
    mockTenantProcessClient,
    mockAgreementProcessClient,
    mockAttributeProcessClient,
    mockAuthorizationClient,
    mockDelegationProcessClient,
    mockEServiceTemplateProcessClient,
    mockInAppNotificationManagerClient,
    fileManager,
    config
  );

  const mockKey = (): authorizationApi.Key => ({
    userId: generateId(),
    kid: "mockKid",
    name: "mockKey",
    encodedPem: "mockPem",
    algorithm: "RS256",
    use: authorizationApi.KeyUse.Values.SIG,
    createdAt: new Date().toISOString(),
  });

  const mockFullProducerKeychain = (
    keys: authorizationApi.Key[],
    producerId: TenantId = tenantId
  ): authorizationApi.ProducerKeychain => ({
    visibility: authorizationApi.Visibility.Values.FULL,
    id: generateId(),
    name: "mockProducerKeychain",
    producerId,
    createdAt: new Date().toISOString(),
    eservices: [eServiceId],
    description: "mockDescription",
    users: [],
    keys,
  });

  const mockProducerKeychainsResponse = (
    results: authorizationApi.ProducerKeychain[]
  ): void => {
    mockProducerKeychains.mockResolvedValueOnce({
      results,
      totalCount: results.length,
    });
  };

  const mockActiveProducerDelegation: delegationApi.Delegation = {
    ...getMockDelegationApiDelegation(),
    delegatorId: tenantId,
    delegateId,
    eserviceId: eServiceId,
    state: delegationApi.DelegationState.Values.ACTIVE,
    kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
  };

  beforeEach(() => {
    mockProducerKeychains.mockReset();
    mockGetDelegations.mockReset();
    mockGetDelegations.mockResolvedValue({
      results: [],
      totalCount: 0,
    });
  });

  it("should return false fields when the descriptor eservice has no producer keychain", async () => {
    mockProducerKeychainsResponse([]);

    const result = await catalogService.getProducerEServiceDescriptor(
      eServiceId,
      descriptorId,
      bffMockContext
    );

    expect(result.hasProducerKeychain).toBe(false);
    expect(result.hasProducerKeychainKeys).toBe(false);
  });

  it("should distinguish a producer keychain without keys", async () => {
    mockProducerKeychainsResponse([mockFullProducerKeychain([])]);

    const result = await catalogService.getProducerEServiceDescriptor(
      eServiceId,
      descriptorId,
      bffMockContext
    );

    expect(result.hasProducerKeychain).toBe(true);
    expect(result.hasProducerKeychainKeys).toBe(false);
  });

  it("should return true fields when the producer keychain has keys", async () => {
    mockProducerKeychainsResponse([mockFullProducerKeychain([mockKey()])]);

    const result = await catalogService.getProducerEServiceDescriptor(
      eServiceId,
      descriptorId,
      bffMockContext
    );

    expect(result.hasProducerKeychain).toBe(true);
    expect(result.hasProducerKeychainKeys).toBe(true);
    expect(mockProducerKeychains).toHaveBeenCalledWith({
      headers: bffMockContext.headers,
      queries: {
        eserviceId: eServiceId,
        producerId: tenantId,
        offset: 0,
        limit: 50,
      },
    });
  });

  it("should check producer keychains owned by the delegated producer requester", async () => {
    mockGetDelegations.mockResolvedValue({
      results: [mockActiveProducerDelegation],
      totalCount: 1,
    });
    mockProducerKeychainsResponse([
      mockFullProducerKeychain([mockKey()], delegateId),
    ]);

    const result = await catalogService.getProducerEServiceDescriptor(
      eServiceId,
      descriptorId,
      delegateBffMockContext
    );

    expect(result.hasProducerKeychain).toBe(true);
    expect(result.hasProducerKeychainKeys).toBe(true);
    expect(mockProducerKeychains).toHaveBeenCalledWith({
      headers: delegateBffMockContext.headers,
      queries: {
        eserviceId: eServiceId,
        producerId: delegateId,
        offset: 0,
        limit: 50,
      },
    });
  });
});
