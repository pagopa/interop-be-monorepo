import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  createDummyStub,
  getMockAuthData,
  getMockContext,
  getMockedApiEservice,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getCatalog", () => {
  it("retrieves requester and producer tenants with one bulk call", async () => {
    const requesterId = generateId<TenantId>();
    const producerId1 = generateId<TenantId>();
    const producerId2 = generateId<TenantId>();
    const eservices = [
      { ...getMockedApiEservice(), producerId: producerId1 },
      { ...getMockedApiEservice(), producerId: producerId2 },
      { ...getMockedApiEservice(), producerId: producerId1 },
    ];
    const tenants: tenantApi.Tenant[] = [
      { ...getMockedApiTenant(), id: requesterId },
      { ...getMockedApiTenant(), id: producerId1 },
      { ...getMockedApiTenant(), id: producerId2 },
    ];
    const getTenants = vi.fn().mockResolvedValue({
      results: tenants,
      totalCount: tenants.length,
    });
    const tenantProcessClient = {
      tenant: { getTenants },
    } as unknown as TenantProcessClient;
    const catalogProcessClient = {
      getEServices: vi.fn().mockResolvedValue({
        results: eservices,
        totalCount: eservices.length,
      }),
    } as unknown as catalogApi.CatalogProcessClient;
    const notificationClient = {
      filterUnreadNotifications: vi.fn().mockResolvedValue([]),
    } as unknown as inAppNotificationApi.InAppNotificationManagerClient;
    const service = catalogServiceBuilder(
      catalogProcessClient,
      tenantProcessClient,
      createDummyStub<agreementApi.AgreementProcessClient>(),
      createDummyStub<attributeRegistryApi.AttributeProcessClient>(),
      createDummyStub<AuthorizationProcessClient>(),
      createDummyStub<DelegationProcessClient>(),
      createDummyStub<eserviceTemplateApi.EServiceTemplateProcessClient>(),
      notificationClient,
      fileManager,
      config
    );
    const ctx = getBffMockContext(
      getMockContext({
        authData: { ...getMockAuthData(), organizationId: requesterId },
      })
    );

    const result = await service.getCatalog(ctx, {
      offset: 0,
      limit: 12,
      eservicesIds: [],
      producersIds: [],
      consumersIds: [],
      states: [],
      attributesIds: [],
      agreementStates: [],
      templatesIds: [],
    });

    expect(result.results).toHaveLength(eservices.length);
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(getTenants).toHaveBeenCalledWith({
      headers: ctx.headers,
      queries: {
        tenantIds: [producerId1, producerId2, requesterId],
        offset: 0,
        limit: 50,
      },
    });
  });
});
