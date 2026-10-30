import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { getMockContext } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { getMockCatalogApiEService } from "./mockUtils.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("queryCatalog", () => {
  const bffMockContext = getBffMockContext(getMockContext({}));

  const mockQueryEServices = vi.fn();
  const mockCatalogProcessClient = {
    queryEServices: mockQueryEServices,
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

  const mockInAppNotificationManagerClient = {
    filterUnreadNotifications: vi.fn().mockResolvedValue([]),
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

  const firstEService: catalogApi.CatalogQueryEService = {
    ...getMockCatalogApiEService(),
    descriptors: [],
    resultType: "eservice",
  };
  const secondEService: catalogApi.CatalogQueryEService = {
    ...getMockCatalogApiEService(),
    descriptors: [],
    resultType: "eservice",
  };
  const templateInstancesGroup: catalogApi.CatalogQueryTemplateInstancesGroup =
    {
      id: generateId(),
      name: "Template name",
      description: "Template description",
      numInstances: 3,
      resultType: "template",
    };

  beforeEach(() => {
    mockQueryEServices.mockReset();
  });

  it("should forward groupByTemplate and keep the order of e-services and template groups", async () => {
    mockQueryEServices.mockResolvedValue({
      results: [firstEService, templateInstancesGroup, secondEService],
      totalCount: 7,
    } satisfies catalogApi.CatalogQueryResults);
    const filters = { offset: 0, limit: 3, groupByTemplate: true };

    const result = await catalogService.queryCatalog(bffMockContext, filters);

    expect(mockQueryEServices).toHaveBeenCalledExactlyOnceWith(filters, {
      headers: bffMockContext.headers,
    });
    expect(result.results.map((r) => [r.resultType, r.id])).toEqual([
      ["eservice", firstEService.id],
      ["template", templateInstancesGroup.id],
      ["eservice", secondEService.id],
    ]);
    expect(result.results[1]).toEqual(templateInstancesGroup);
    expect(result.pagination).toEqual({ offset: 0, limit: 3, totalCount: 7 });
  });

  it("should enrich the e-services with their producer", async () => {
    mockQueryEServices.mockResolvedValue({
      results: [firstEService],
      totalCount: 1,
    } satisfies catalogApi.CatalogQueryResults);

    const result = await catalogService.queryCatalog(bffMockContext, {
      offset: 0,
      limit: 10,
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        resultType: "eservice",
        id: firstEService.id,
        name: firstEService.name,
        producer: expect.objectContaining({
          id: firstEService.producerId,
          name: "mockTenant",
        }),
      }),
    ]);
  });
});
