import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
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
import { getMockCatalogApiEService } from "./mockUtils.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getFeaturedCatalog", () => {
  const requesterId: TenantId = generateId<TenantId>();
  const producerId: TenantId = generateId<TenantId>();
  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: requesterId,
  };
  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  const eservices: catalogApi.EService[] = [
    { ...getMockCatalogApiEService(), producerId, descriptors: [] },
    { ...getMockCatalogApiEService(), producerId, descriptors: [] },
  ];

  const tenants: Record<string, { id: string; name: string }> = {
    [requesterId]: { id: requesterId, name: "Requester" },
    [producerId]: { id: producerId, name: "Producer" },
  };

  const queryEServices = vi.fn();
  const filterUnreadNotifications = vi.fn();

  const catalogService = catalogServiceBuilder(
    { queryEServices } as unknown as catalogApi.CatalogProcessClient,
    {
      tenant: {
        getTenant: vi.fn(({ params }: { params: { id: string } }) =>
          Promise.resolve(tenants[params.id])
        ),
      },
    } as unknown as TenantProcessClient,
    {} as unknown as agreementApi.AgreementProcessClient,
    {} as unknown as attributeRegistryApi.AttributeProcessClient,
    {} as unknown as AuthorizationProcessClient,
    {} as unknown as DelegationProcessClient,
    {} as unknown as eserviceTemplateApi.EServiceTemplateProcessClient,
    {
      filterUnreadNotifications,
    } as unknown as inAppNotificationApi.InAppNotificationManagerClient,
    fileManager,
    config
  );

  beforeEach(() => {
    queryEServices.mockReset();
    filterUnreadNotifications.mockReset();
    queryEServices.mockResolvedValue({ results: eservices, totalCount: 30 });
    filterUnreadNotifications.mockResolvedValue([eservices[0].id]);
  });

  it("should query the catalog with the featured filters and the limit of 12", async () => {
    await catalogService.getFeaturedCatalog(bffMockContext);

    expect(queryEServices).toHaveBeenCalledExactlyOnceWith(
      {
        offset: 0,
        limit: 12,
        availableForRequester: true,
        subscribedByRequester: false,
        sortBy: "CREATED_AT_DESC",
      },
      { headers: bffMockContext.headers }
    );
  });

  it("should map the e-services to catalog e-services in the returned order", async () => {
    const expected: bffApi.CatalogEService[] = eservices.map((eservice) => ({
      id: eservice.id,
      name: eservice.name,
      description: eservice.description,
      producer: { id: producerId, name: "Producer", selfcareId: undefined },
      isMine: false,
      hasUnreadNotifications: eservice.id === eservices[0].id,
      personalData: eservice.personalData,
      asyncExchange: eservice.asyncExchange,
    }));

    expect(await catalogService.getFeaturedCatalog(bffMockContext)).toEqual(
      expected
    );
  });

  it("should return an empty array when no e-service is featured", async () => {
    queryEServices.mockResolvedValue({ results: [], totalCount: 0 });

    expect(await catalogService.getFeaturedCatalog(bffMockContext)).toEqual([]);
  });
});
