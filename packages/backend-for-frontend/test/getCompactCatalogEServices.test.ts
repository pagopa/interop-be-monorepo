import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import {
  getMockCatalogApiEService,
  getMockCatalogApiEServiceDescriptor,
} from "./mockUtils.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getCompactCatalogEServices", () => {
  const requesterId: TenantId = generateId<TenantId>();
  const producerId: TenantId = generateId<TenantId>();
  const otherProducerId: TenantId = generateId<TenantId>();

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: requesterId,
  };
  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  const publishedDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockCatalogApiEServiceDescriptor(),
    version: "1",
    state: catalogApi.EServiceDescriptorState.Values.PUBLISHED,
    templateVersionRef: { id: generateId() },
    archivingSchedule: undefined,
  };

  const draftDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockCatalogApiEServiceDescriptor(),
    version: "2",
    state: catalogApi.EServiceDescriptorState.Values.DRAFT,
    templateVersionRef: undefined,
  };

  const eservice1: catalogApi.EService = {
    ...getMockCatalogApiEService(),
    producerId,
    personalData: true,
    descriptors: [publishedDescriptor, draftDescriptor],
  };

  const eservice2: catalogApi.EService = {
    ...getMockCatalogApiEService(),
    producerId,
    personalData: false,
    descriptors: [],
  };

  const eservice3: catalogApi.EService = {
    ...getMockCatalogApiEService(),
    producerId: otherProducerId,
    personalData: undefined,
    descriptors: [publishedDescriptor],
  };

  const tenantsById: Record<string, { id: string; name: string }> = {
    [producerId]: { id: producerId, name: "Producer One" },
    [otherProducerId]: { id: otherProducerId, name: "Producer Two" },
  };

  const mockGetEServices = vi.fn();
  const mockGetTenant = vi.fn();
  const mockFilterUnreadNotifications = vi.fn();

  const mockCatalogProcessClient = {
    getEServices: mockGetEServices,
  } as unknown as catalogApi.CatalogProcessClient;

  const mockTenantProcessClient = {
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as TenantProcessClient;

  const mockInAppNotificationManagerClient = {
    filterUnreadNotifications: mockFilterUnreadNotifications,
  } as unknown as inAppNotificationApi.InAppNotificationManagerClient;

  const catalogService = catalogServiceBuilder(
    mockCatalogProcessClient,
    mockTenantProcessClient,
    {} as unknown as agreementApi.AgreementProcessClient,
    {} as unknown as attributeRegistryApi.AttributeProcessClient,
    {} as unknown as AuthorizationProcessClient,
    {} as unknown as DelegationProcessClient,
    {} as unknown as eserviceTemplateApi.EServiceTemplateProcessClient,
    mockInAppNotificationManagerClient,
    fileManager,
    config
  );

  const defaultQueries: catalogApi.GetEServicesQueryParams = {
    offset: 0,
    limit: 50,
    eservicesIds: [],
    producersIds: [],
    attributesIds: [],
    consumersIds: [],
    templatesIds: [],
    states: [],
    agreementStates: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEServices.mockResolvedValue({
      results: [eservice1, eservice2, eservice3],
      totalCount: 3,
    });
    mockGetTenant.mockImplementation(
      async ({ params }: { params: { id: string } }) => ({
        ...tenantsById[params.id],
        attributes: [],
      })
    );
  });

  it("should return the compact eservices with pagination", async () => {
    const result = await catalogService.getCompactCatalogEServices(
      bffMockContext,
      defaultQueries
    );

    expect(result.pagination).toEqual({
      offset: 0,
      limit: 50,
      totalCount: 3,
    });
    expect(result.results).toEqual([
      {
        id: eservice1.id,
        name: eservice1.name,
        producer: { id: producerId, name: "Producer One" },
        personalData: true,
        activeDescriptor: {
          id: publishedDescriptor.id,
          version: publishedDescriptor.version,
          audience: publishedDescriptor.audience,
          state: publishedDescriptor.state,
          templateVersionId: publishedDescriptor.templateVersionRef?.id,
          archivableOn: undefined,
        },
      },
      {
        id: eservice2.id,
        name: eservice2.name,
        producer: { id: producerId, name: "Producer One" },
        personalData: false,
      },
      {
        id: eservice3.id,
        name: eservice3.name,
        producer: { id: otherProducerId, name: "Producer Two" },
        personalData: undefined,
        activeDescriptor: {
          id: publishedDescriptor.id,
          version: publishedDescriptor.version,
          audience: publishedDescriptor.audience,
          state: publishedDescriptor.state,
          templateVersionId: publishedDescriptor.templateVersionRef?.id,
          archivableOn: undefined,
        },
      },
    ]);
  });

  it("should not return the fields excluded from the compact payload", async () => {
    const result = await catalogService.getCompactCatalogEServices(
      bffMockContext,
      defaultQueries
    );

    for (const eservice of result.results) {
      expect(eservice).not.toHaveProperty("description");
      expect(eservice).not.toHaveProperty("isMine");
      expect(eservice).not.toHaveProperty("hasUnreadNotifications");
      expect(eservice).not.toHaveProperty("asyncExchange");
      expect(eservice.producer).not.toHaveProperty("selfcareId");
      expect(eservice.producer).not.toHaveProperty("hasUnreadNotifications");
    }
  });

  it("should not call the in-app notification manager", async () => {
    await catalogService.getCompactCatalogEServices(
      bffMockContext,
      defaultQueries
    );

    expect(mockFilterUnreadNotifications).not.toHaveBeenCalled();
  });

  it("should retrieve each distinct producer only once and skip the requester", async () => {
    await catalogService.getCompactCatalogEServices(
      bffMockContext,
      defaultQueries
    );

    expect(mockGetTenant).toHaveBeenCalledTimes(2);
    expect(mockGetTenant).toHaveBeenCalledWith({
      headers: bffMockContext.headers,
      params: { id: producerId },
    });
    expect(mockGetTenant).toHaveBeenCalledWith({
      headers: bffMockContext.headers,
      params: { id: otherProducerId },
    });
    expect(mockGetTenant).not.toHaveBeenCalledWith({
      headers: bffMockContext.headers,
      params: { id: requesterId },
    });
  });

  it("should forward the queries to catalog process unchanged", async () => {
    const queries: catalogApi.GetEServicesQueryParams = {
      ...defaultQueries,
      name: "eservice name",
      states: [catalogApi.EServiceDescriptorState.Values.PUBLISHED],
      agreementStates: [catalogApi.AgreementState.Values.ACTIVE],
      mode: catalogApi.EServiceMode.Values.DELIVER,
      isConsumerDelegable: true,
      personalData: "TRUE",
    };

    await catalogService.getCompactCatalogEServices(bffMockContext, queries);

    expect(mockGetEServices).toHaveBeenCalledWith({
      headers: bffMockContext.headers,
      queries,
    });
  });
});
