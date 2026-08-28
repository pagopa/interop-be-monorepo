import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { FileManager, genericLogger } from "pagopa-interop-commons";
import {
  createDummyStub,
  getMockAuthData,
  getMockContext,
  getMockedApiEservice,
  getMockedApiEServiceTemplate,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplateId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";

const getBffMockContext = (ctx: ReturnType<typeof getMockContext>) => ({
  ...ctx,
  headers: {
    "X-Correlation-Id": ctx.correlationId,
    Authorization: "authorization",
    "X-Forwarded-For": "x-forwarded-for",
  },
  logger: genericLogger,
});

const buildService = ({
  eservices,
  tenants,
}: {
  eservices: catalogApi.EService[];
  tenants: tenantApi.Tenant[];
}) => {
  const getTenants = vi.fn().mockImplementation(({ queries }) => {
    const results = queries.name
      ? tenants.filter((tenant) => tenant.name.includes(queries.name))
      : tenants.filter((tenant) => queries.tenantIds.includes(tenant.id));

    return Promise.resolve({ results, totalCount: results.length });
  });
  const getTenant = vi.fn();
  const tenantProcessClient = {
    tenant: { getTenant, getTenants },
  } as unknown as TenantProcessClient;
  const catalogProcessClient = {
    getEServices: vi.fn().mockResolvedValue({
      results: eservices,
      totalCount: eservices.length,
    }),
  } as unknown as catalogApi.CatalogProcessClient;
  const eserviceTemplateProcessClient = {
    getEServiceTemplateById: vi
      .fn()
      .mockResolvedValue(getMockedApiEServiceTemplate()),
  } as unknown as eserviceTemplateApi.EServiceTemplateProcessClient;

  return {
    service: catalogServiceBuilder(
      catalogProcessClient,
      tenantProcessClient,
      createDummyStub<agreementApi.AgreementProcessClient>(),
      createDummyStub<attributeRegistryApi.AttributeProcessClient>(),
      createDummyStub<AuthorizationProcessClient>(),
      createDummyStub<DelegationProcessClient>(),
      eserviceTemplateProcessClient,
      createDummyStub<inAppNotificationApi.InAppNotificationManagerClient>(),
      createDummyStub<FileManager>(),
      config
    ),
    getTenant,
    getTenants,
  };
};

describe("getEServiceTemplateInstances", () => {
  it("retrieves duplicated producers with one bulk tenant call", async () => {
    const templateId = generateId<EServiceTemplateId>();
    const producerId1 = generateId<TenantId>();
    const producerId2 = generateId<TenantId>();
    const eservices = [
      { ...getMockedApiEservice(), producerId: producerId1 },
      { ...getMockedApiEservice(), producerId: producerId2 },
      { ...getMockedApiEservice(), producerId: producerId1 },
    ];
    const tenants = [
      { ...getMockedApiTenant(), id: producerId1, name: "Producer one" },
      { ...getMockedApiTenant(), id: producerId2, name: "Producer two" },
    ];
    const { service, getTenant, getTenants } = buildService({
      eservices,
      tenants,
    });
    const ctx = getBffMockContext(getMockContext({}));

    const result = await service.getEServiceTemplateInstances(
      templateId,
      undefined,
      [],
      0,
      10,
      ctx
    );

    expect(result.results.map(({ producerName }) => producerName)).toEqual([
      "Producer one",
      "Producer two",
      "Producer one",
    ]);
    expect(result.pagination).toEqual({
      offset: 0,
      limit: 10,
      totalCount: eservices.length,
    });
    expect(getTenant).not.toHaveBeenCalled();
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(getTenants).toHaveBeenCalledWith({
      headers: ctx.headers,
      queries: {
        tenantIds: [producerId1, producerId2],
        offset: 0,
        limit: 50,
      },
    });
  });

  it("reuses producer-name tenants without additional downstream calls", async () => {
    const templateId = generateId<EServiceTemplateId>();
    const producerId = generateId<TenantId>();
    const eservices = [{ ...getMockedApiEservice(), producerId }];
    const tenants = [
      { ...getMockedApiTenant(), id: producerId, name: "Matching producer" },
    ];
    const { service, getTenant, getTenants } = buildService({
      eservices,
      tenants,
    });
    const ctx = getBffMockContext(getMockContext({}));

    const result = await service.getEServiceTemplateInstances(
      templateId,
      "Matching",
      [],
      0,
      10,
      ctx
    );

    expect(result.results).toHaveLength(1);
    expect(getTenant).not.toHaveBeenCalled();
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(getTenants).toHaveBeenCalledWith({
      headers: ctx.headers,
      queries: {
        name: "Matching",
        offset: 0,
        limit: 50,
      },
    });
  });
});

describe("getMyEServiceTemplateInstances", () => {
  it("retrieves the producer once in bulk for all instances", async () => {
    const templateId = generateId<EServiceTemplateId>();
    const producerId = generateId<TenantId>();
    const eservices = [
      { ...getMockedApiEservice(), producerId },
      { ...getMockedApiEservice(), producerId },
      { ...getMockedApiEservice(), producerId },
    ];
    const tenants = [
      { ...getMockedApiTenant(), id: producerId, name: "My producer" },
    ];
    const { service, getTenant, getTenants } = buildService({
      eservices,
      tenants,
    });
    const ctx = getBffMockContext(
      getMockContext({
        authData: { ...getMockAuthData(), organizationId: producerId },
      })
    );

    const result = await service.getMyEServiceTemplateInstances(
      templateId,
      0,
      10,
      ctx
    );

    expect(result.results).toHaveLength(eservices.length);
    expect(getTenant).not.toHaveBeenCalled();
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(getTenants).toHaveBeenCalledWith({
      headers: ctx.headers,
      queries: {
        tenantIds: [producerId],
        offset: 0,
        limit: 50,
      },
    });
  });
});
