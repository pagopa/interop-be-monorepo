import {
  catalogApi,
  eserviceTemplateApi,
  purposeTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  createDummyStub,
  getMockContext,
  getMockedApiTenant,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import type { TenantProcessClient } from "../src/clients/clientsProvider.js";

import { tenantNotFound } from "../src/model/errors.js";
import { purposeTemplateServiceBuilder } from "../src/services/purposeTemplateService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getCatalogPurposeTemplates", () => {
  const ctx = getBffMockContext(getMockContext({}));

  const getPurposeTemplate = (
    creatorId: TenantId
  ): purposeTemplateApi.PurposeTemplate => ({
    ...getMockPurposeTemplate(creatorId),
    state: purposeTemplateApi.PurposeTemplateState.Enum.PUBLISHED,
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
    purposeRiskAnalysisForm: undefined,
  });

  const buildService = (
    purposeTemplates: purposeTemplateApi.PurposeTemplate[],
    tenants: tenantApi.Tenant[]
  ) => {
    const getPurposeTemplates = vi.fn().mockResolvedValue({
      results: purposeTemplates,
      totalCount: purposeTemplates.length,
    });
    const getTenants = vi.fn().mockResolvedValue({
      results: tenants,
      totalCount: tenants.length,
    });
    const getTenant = vi.fn();

    const purposeTemplateClient = {
      getPurposeTemplates,
    } as unknown as purposeTemplateApi.PurposeTemplateProcessClient;
    const tenantProcessClient = {
      tenant: { getTenant, getTenants },
    } as unknown as TenantProcessClient;

    return {
      service: purposeTemplateServiceBuilder(
        purposeTemplateClient,
        tenantProcessClient,
        createDummyStub<catalogApi.CatalogProcessClient>(),
        createDummyStub<eserviceTemplateApi.EServiceTemplateProcessClient>(),
        fileManager
      ),
      getTenant,
      getTenants,
    };
  };

  const getCatalogPurposeTemplates = (
    service: ReturnType<typeof purposeTemplateServiceBuilder>
  ) =>
    service.getCatalogPurposeTemplates({
      purposeTitle: undefined,
      targetTenantKind: undefined,
      creatorIds: [],
      eserviceIds: [],
      excludeExpiredRiskAnalysis: false,
      handlesPersonalData: undefined,
      offset: 0,
      limit: 50,
      ctx,
    });

  it("retrieves distinct creators with one bulk tenant call", async () => {
    const creatorId1 = generateId<TenantId>();
    const creatorId2 = generateId<TenantId>();
    const purposeTemplates = [
      getPurposeTemplate(creatorId1),
      getPurposeTemplate(creatorId2),
      getPurposeTemplate(creatorId1),
    ];
    const tenants = [
      { ...getMockedApiTenant(), id: creatorId1 },
      { ...getMockedApiTenant(), id: creatorId2 },
    ];
    const { service, getTenant, getTenants } = buildService(
      purposeTemplates,
      tenants
    );

    const result = await getCatalogPurposeTemplates(service);

    expect(result.results).toHaveLength(purposeTemplates.length);
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
    const { service } = buildService([getPurposeTemplate(creatorId)], []);

    await expect(getCatalogPurposeTemplates(service)).rejects.toThrow(
      tenantNotFound(creatorId).message
    );
  });

  it("does not retrieve tenants when the purpose template page is empty", async () => {
    const { service, getTenant, getTenants } = buildService([], []);

    const result = await getCatalogPurposeTemplates(service);

    expect(result.results).toEqual([]);
    expect(getTenant).not.toHaveBeenCalled();
    expect(getTenants).not.toHaveBeenCalled();
  });
});
