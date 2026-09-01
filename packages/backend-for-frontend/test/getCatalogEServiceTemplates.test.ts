import {
  attributeRegistryApi,
  eserviceTemplateApi,
  inAppNotificationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  createDummyStub,
  getMockContext,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import type { TenantProcessClient } from "../src/clients/clientsProvider.js";

import { tenantNotFound } from "../src/model/errors.js";
import { eserviceTemplateServiceBuilder } from "../src/services/eserviceTemplateService.js";
import { fileManager, getBffMockContext } from "./utils.js";

const buildService = ({
  templates,
  tenants,
}: {
  templates: eserviceTemplateApi.EServiceTemplate[];
  tenants: tenantApi.Tenant[];
}) => {
  const getTenant = vi.fn().mockImplementation(({ params }) => {
    const tenant = tenants.find(({ id }) => id === params.id);
    return tenant
      ? Promise.resolve(tenant)
      : Promise.reject(tenantNotFound(params.id));
  });
  const getTenants = vi.fn().mockResolvedValue({
    results: tenants,
    totalCount: tenants.length,
  });
  const tenantProcessClient = {
    tenant: { getTenant, getTenants },
  } as unknown as TenantProcessClient;
  const eserviceTemplateClient = {
    getEServiceTemplates: vi.fn().mockResolvedValue({
      results: templates,
      totalCount: templates.length,
    }),
  } as unknown as eserviceTemplateApi.EServiceTemplateProcessClient;

  return {
    service: eserviceTemplateServiceBuilder(
      eserviceTemplateClient,
      tenantProcessClient,
      createDummyStub<attributeRegistryApi.AttributeProcessClient>(),
      createDummyStub<inAppNotificationApi.InAppNotificationManagerClient>(),
      fileManager
    ),
    getTenant,
    getTenants,
  };
};

const getPublishedTemplate = (creatorId: TenantId) => ({
  ...getMockedApiEServiceTemplate({
    versions: [
      getMockedApiEserviceTemplateVersion({
        state:
          eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED,
      }),
    ],
  }),
  creatorId,
});

describe("getCatalogEServiceTemplates", () => {
  it("retrieves duplicated creators with one bulk tenant call", async () => {
    const creatorId1 = generateId<TenantId>();
    const creatorId2 = generateId<TenantId>();
    const templates = [
      getPublishedTemplate(creatorId1),
      getPublishedTemplate(creatorId2),
      getPublishedTemplate(creatorId1),
    ];
    const tenants = [
      { ...getMockedApiTenant(), id: creatorId1, name: "Creator one" },
      { ...getMockedApiTenant(), id: creatorId2, name: "Creator two" },
    ];
    const { service, getTenant, getTenants } = buildService({
      templates,
      tenants,
    });
    const ctx = getBffMockContext(getMockContext({}));

    const result = await service.getCatalogEServiceTemplates(
      undefined,
      [],
      undefined,
      0,
      10,
      ctx
    );

    expect(result.results.map(({ creator }) => creator.name)).toEqual([
      "Creator one",
      "Creator two",
      "Creator one",
    ]);
    expect(result.pagination).toEqual({
      offset: 0,
      limit: 10,
      totalCount: templates.length,
    });
    expect(getTenant).not.toHaveBeenCalled();
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(getTenants).toHaveBeenCalledWith({
      headers: ctx.headers,
      queries: {
        tenantIds: [creatorId1, creatorId2],
        offset: 0,
        limit: 50,
      },
    });
  });

  it("throws tenantNotFound when a creator is missing from the bulk response", async () => {
    const creatorId = generateId<TenantId>();
    const { service, getTenant, getTenants } = buildService({
      templates: [getPublishedTemplate(creatorId)],
      tenants: [],
    });
    const ctx = getBffMockContext(getMockContext({}));

    await expect(
      service.getCatalogEServiceTemplates(undefined, [], undefined, 0, 10, ctx)
    ).rejects.toThrow(tenantNotFound(creatorId).message);
    expect(getTenant).not.toHaveBeenCalled();
    expect(getTenants).toHaveBeenCalledTimes(1);
  });
});
