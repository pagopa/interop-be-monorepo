import {
  attributeRegistryApi,
  agreementApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import {
  DescriptorId,
  EServiceId,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getProducerEServiceDetails", () => {
  const tenantId: TenantId = generateId<TenantId>();
  const eServiceId: EServiceId = generateId<EServiceId>();

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: tenantId,
  };
  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  const baseDescriptor = (
    state: catalogApi.EServiceDescriptorState,
    version: string
  ): catalogApi.EServiceDescriptor => ({
    id: generateId<DescriptorId>(),
    state,
    version,
    attributes: { declared: [], certified: [], verified: [] },
    serverUrls: [],
    audience: [],
    voucherLifespan: 60,
    dailyCallsPerConsumer: 1,
    dailyCallsTotal: 1,
    docs: [],
    agreementApprovalPolicy:
      catalogApi.AgreementApprovalPolicy.Values.AUTOMATIC,
  });

  const deprecatedDescriptor = baseDescriptor(
    catalogApi.EServiceDescriptorState.Values.DEPRECATED,
    "1"
  );
  const publishedDescriptor = baseDescriptor(
    catalogApi.EServiceDescriptorState.Values.PUBLISHED,
    "2"
  );
  const draftDescriptor = baseDescriptor(
    catalogApi.EServiceDescriptorState.Values.DRAFT,
    "3"
  );

  const eService: catalogApi.EService = {
    id: eServiceId,
    name: "mockEService",
    producerId: tenantId,
    description: "mockDescription",
    technology: catalogApi.EServiceTechnology.Values.REST,
    descriptors: [deprecatedDescriptor, publishedDescriptor, draftDescriptor],
    mode: catalogApi.EServiceMode.Values.RECEIVE,
    riskAnalysis: [],
    asyncExchange: true,
  };

  const mockGetEServiceById = vi.fn();
  const mockCatalogProcessClient = {
    getEServiceById: mockGetEServiceById,
  } as unknown as catalogApi.CatalogProcessClient;

  const mockTenantProcessClient = {
    tenant: {
      getTenant: vi.fn(({ params: { id } }) => ({
        id,
        name: "mockTenant",
        attributes: [],
        mails: [],
      })),
    },
  } as unknown as TenantProcessClient;

  const mockAgreementProcessClient =
    {} as unknown as agreementApi.AgreementProcessClient;

  const mockAttributeProcessClient =
    {} as unknown as attributeRegistryApi.AttributeProcessClient;

  const mockAuthorizationClient = {} as unknown as AuthorizationProcessClient;

  const mockDelegationProcessClient = {
    delegation: {
      getDelegations: vi.fn().mockResolvedValue({ results: [], totalCount: 0 }),
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

  beforeEach(() => {
    mockGetEServiceById.mockReset();
  });

  it("should map asyncExchange and latestActiveDescriptorId from the eservice, picking the latest active descriptor and ignoring drafts", async () => {
    mockGetEServiceById.mockResolvedValue(eService);

    const result = await catalogService.getProducerEServiceDetails(
      eServiceId,
      bffMockContext
    );

    expect(result.asyncExchange).toBe(true);
    expect(result.latestActiveDescriptorId).toBe(publishedDescriptor.id);
  });

  it("should return undefined latestActiveDescriptorId when no active descriptor exists", async () => {
    mockGetEServiceById.mockResolvedValue({
      ...eService,
      asyncExchange: false,
      descriptors: [draftDescriptor],
    });

    const result = await catalogService.getProducerEServiceDetails(
      eServiceId,
      bffMockContext
    );

    expect(result.asyncExchange).toBe(false);
    expect(result.latestActiveDescriptorId).toBeUndefined();
  });
});
