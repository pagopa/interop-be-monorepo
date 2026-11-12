import {
  catalogApi,
  eserviceTemplateApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { AuthData } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockedApiEServiceTemplate,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { generateId, PurposeTemplateId, TenantId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import type { TenantProcessClient } from "../src/clients/clientsProvider.js";

import {
  eserviceDescriptorNotFound,
  eServiceNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  tenantNotFound,
} from "../src/model/errors.js";
import { purposeTemplateServiceBuilder } from "../src/services/purposeTemplateService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getPurposeTemplateLinkableResources (service)", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const requesterId = generateId<TenantId>();
  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: requesterId,
  };
  const ctx = getBffMockContext(getMockContext({ authData }));

  const buildService = (overrides: {
    getPurposeTemplateEServices?: ReturnType<typeof vi.fn>;
    getPurposeTemplateEServiceTemplates?: ReturnType<typeof vi.fn>;
    getEServices?: ReturnType<typeof vi.fn>;
    getEServiceTemplates?: ReturnType<typeof vi.fn>;
    getTenant?: ReturnType<typeof vi.fn>;
  }) => {
    const purposeTemplateClient = {
      getPurposeTemplateEServices:
        overrides.getPurposeTemplateEServices ??
        vi.fn().mockResolvedValue({ results: [], totalCount: 0 }),
      getPurposeTemplateEServiceTemplates:
        overrides.getPurposeTemplateEServiceTemplates ??
        vi.fn().mockResolvedValue({ results: [], totalCount: 0 }),
    } as unknown as purposeTemplateApi.PurposeTemplateProcessClient;

    const catalogProcessClient = {
      getEServices:
        overrides.getEServices ?? vi.fn().mockResolvedValue({ results: [] }),
    } as unknown as catalogApi.CatalogProcessClient;

    const eserviceTemplateProcessClient = {
      getEServiceTemplates:
        overrides.getEServiceTemplates ??
        vi.fn().mockResolvedValue({ results: [] }),
    } as unknown as eserviceTemplateApi.EServiceTemplateProcessClient;

    const tenantProcessClient = {
      tenant: {
        getTenant: overrides.getTenant ?? vi.fn(),
      },
    } as unknown as TenantProcessClient;

    return {
      service: purposeTemplateServiceBuilder(
        purposeTemplateClient,
        tenantProcessClient,
        catalogProcessClient,
        eserviceTemplateProcessClient,
        fileManager
      ),
      mocks: {
        getPurposeTemplateEServices:
          purposeTemplateClient.getPurposeTemplateEServices,
        getPurposeTemplateEServiceTemplates:
          purposeTemplateClient.getPurposeTemplateEServiceTemplates,
        getEServices: catalogProcessClient.getEServices,
        getEServiceTemplates:
          eserviceTemplateProcessClient.getEServiceTemplates,
        getTenant: tenantProcessClient.tenant.getTenant,
      },
    };
  };

  // Builders for mock entities consistent with the link-based fan-out

  const buildConcreteFixture = (createdAt: string) => {
    const descriptor = getMockedApiEserviceDescriptor();
    const eservice = getMockedApiEservice({ descriptors: [descriptor] });
    const link: purposeTemplateApi.EServiceDescriptorPurposeTemplate = {
      purposeTemplateId,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      createdAt,
    };
    const tenant = { ...getMockedApiTenant(), id: eservice.producerId };
    return { link, eservice, descriptor, tenant };
  };

  const buildTemplateFixture = (createdAt: string) => {
    const eserviceTemplate = getMockedApiEServiceTemplate();
    const version = eserviceTemplate.versions[0];
    const link: purposeTemplateApi.EServiceTemplateVersionPurposeTemplate = {
      purposeTemplateId,
      eserviceTemplateId: eserviceTemplate.id,
      eserviceTemplateVersionId: version.id,
      createdAt,
    };
    const tenant = { ...getMockedApiTenant(), id: eserviceTemplate.creatorId };
    return { link, eserviceTemplate, version, tenant };
  };

  it("merges concrete + template, sorts by createdAt DESC, slices the page, and enriches", async () => {
    const concreteOldest = buildConcreteFixture("2026-01-01T00:00:00.000Z");
    const templateMid = buildTemplateFixture("2026-02-01T00:00:00.000Z");
    const concreteNewest = buildConcreteFixture("2026-03-01T00:00:00.000Z");

    const { service, mocks } = buildService({
      getPurposeTemplateEServices: vi.fn().mockResolvedValue({
        results: [concreteOldest.link, concreteNewest.link],
        totalCount: 2,
      }),
      getPurposeTemplateEServiceTemplates: vi.fn().mockResolvedValue({
        results: [templateMid.link],
        totalCount: 1,
      }),
      getEServices: vi.fn().mockResolvedValue({
        results: [concreteOldest.eservice, concreteNewest.eservice],
      }),
      getEServiceTemplates: vi
        .fn()
        .mockResolvedValue({ results: [templateMid.eserviceTemplate] }),
      getTenant: vi
        .fn()
        .mockImplementation(({ params: { id } }) =>
          Promise.resolve(
            [
              concreteOldest.tenant,
              concreteNewest.tenant,
              templateMid.tenant,
            ].find((t) => t.id === id)
          )
        ),
    });

    const result = await service.getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds: [],
      offset: 0,
      limit: 10,
      ctx,
    });

    expect(result.pagination).toEqual({ offset: 0, limit: 10, totalCount: 3 });
    expect(result.results.map((r) => r.resourceKind)).toEqual([
      "ESERVICE",
      "ESERVICE_TEMPLATE",
      "ESERVICE",
    ]);
    expect(result.results[0].createdAt).toBe(concreteNewest.link.createdAt);
    expect(result.results[2].createdAt).toBe(concreteOldest.link.createdAt);
    expect(mocks.getEServices).toHaveBeenCalledTimes(1);
    expect(mocks.getEServiceTemplates).toHaveBeenCalledTimes(1);
  });

  it("performs multi round-trip until each upstream is exhausted", async () => {
    const fullPage = Array.from({ length: 50 }, (_, i) =>
      buildConcreteFixture(
        `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`
      )
    );
    const tail = [buildConcreteFixture("2026-05-01T00:00:00.000Z")];
    const allConcrete = [...fullPage, ...tail];

    const getPurposeTemplateEServices = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          results: fullPage.map((f) => f.link),
          totalCount: 51,
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ results: tail.map((f) => f.link), totalCount: 51 })
      );

    const { service, mocks } = buildService({
      getPurposeTemplateEServices,
      getEServices: vi
        .fn()
        .mockResolvedValue({ results: allConcrete.map((f) => f.eservice) }),
      getTenant: vi
        .fn()
        .mockImplementation(({ params: { id } }) =>
          Promise.resolve(allConcrete.find((f) => f.tenant.id === id)?.tenant)
        ),
    });

    const result = await service.getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds: [],
      offset: 0,
      limit: 50,
      ctx,
    });

    expect(mocks.getPurposeTemplateEServices).toHaveBeenCalledTimes(2);
    expect(mocks.getPurposeTemplateEServices).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        queries: expect.objectContaining({ offset: 0, limit: 50 }),
      })
    );
    expect(mocks.getPurposeTemplateEServices).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        queries: expect.objectContaining({ offset: 50, limit: 50 }),
      })
    );
    expect(result.pagination.totalCount).toBe(51);
    expect(result.results).toHaveLength(50);
  });

  it("performs multi round-trip on the template upstream until exhausted", async () => {
    const fullPage = Array.from({ length: 50 }, (_, i) =>
      buildTemplateFixture(
        `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`
      )
    );
    const tail = [buildTemplateFixture("2026-05-01T00:00:00.000Z")];
    const allTemplates = [...fullPage, ...tail];

    const getPurposeTemplateEServiceTemplates = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          results: fullPage.map((f) => f.link),
          totalCount: 51,
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ results: tail.map((f) => f.link), totalCount: 51 })
      );

    const { service, mocks } = buildService({
      getPurposeTemplateEServiceTemplates,
      getEServiceTemplates: vi.fn().mockResolvedValue({
        results: allTemplates.map((f) => f.eserviceTemplate),
      }),
      getTenant: vi
        .fn()
        .mockImplementation(({ params: { id } }) =>
          Promise.resolve(allTemplates.find((f) => f.tenant.id === id)?.tenant)
        ),
    });

    const result = await service.getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds: [],
      offset: 0,
      limit: 50,
      ctx,
    });

    expect(mocks.getPurposeTemplateEServiceTemplates).toHaveBeenCalledTimes(2);
    expect(mocks.getPurposeTemplateEServiceTemplates).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        queries: expect.objectContaining({ offset: 0, limit: 50 }),
      })
    );
    expect(mocks.getPurposeTemplateEServiceTemplates).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        queries: expect.objectContaining({ offset: 50, limit: 50 }),
      })
    );
    expect(result.pagination.totalCount).toBe(51);
    expect(result.results).toHaveLength(50);
  });

  it("returns empty results without invoking enrichment when offset is past the merged list size", async () => {
    const fixtures = [1, 2, 3].map((i) =>
      buildConcreteFixture(`2026-0${i}-01T00:00:00.000Z`)
    );

    const { service, mocks } = buildService({
      getPurposeTemplateEServices: vi.fn().mockResolvedValue({
        results: fixtures.map((f) => f.link),
        totalCount: fixtures.length,
      }),
    });

    const result = await service.getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds: [],
      offset: 10,
      limit: 10,
      ctx,
    });

    expect(result).toEqual({
      results: [],
      pagination: { offset: 10, limit: 10, totalCount: 3 },
    });
    expect(mocks.getEServices).toHaveBeenCalledTimes(0);
    expect(mocks.getEServiceTemplates).toHaveBeenCalledTimes(0);
    expect(mocks.getTenant).toHaveBeenCalledTimes(0);
  });

  it("applies offset/limit on the merged list", async () => {
    const fixtures = [1, 2, 3, 4, 5].map((i) =>
      buildConcreteFixture(`2026-0${i}-01T00:00:00.000Z`)
    );

    const { service } = buildService({
      getPurposeTemplateEServices: vi.fn().mockResolvedValue({
        results: fixtures.map((f) => f.link),
        totalCount: fixtures.length,
      }),
      getEServices: vi
        .fn()
        .mockResolvedValue({ results: fixtures.map((f) => f.eservice) }),
      getTenant: vi
        .fn()
        .mockImplementation(({ params: { id } }) =>
          Promise.resolve(fixtures.find((f) => f.tenant.id === id)?.tenant)
        ),
    });

    const result = await service.getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds: [],
      offset: 2,
      limit: 2,
      ctx,
    });

    expect(result.pagination).toEqual({ offset: 2, limit: 2, totalCount: 5 });
    expect(result.results.map((r) => r.createdAt)).toEqual([
      fixtures[2].link.createdAt,
      fixtures[1].link.createdAt,
    ]);
  });

  it("maps publisherIds and q to upstream-specific filters", async () => {
    const publisherA = generateId();
    const publisherB = generateId();

    const { service, mocks } = buildService({});

    await service.getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds: [publisherA, publisherB],
      q: "alpha",
      offset: 0,
      limit: 10,
      ctx,
    });

    expect(mocks.getPurposeTemplateEServices).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: expect.objectContaining({
          producerIds: [publisherA, publisherB],
          eserviceName: "alpha",
        }),
      })
    );
    expect(mocks.getPurposeTemplateEServiceTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: expect.objectContaining({
          creatorIds: [publisherA, publisherB],
          eserviceTemplateName: "alpha",
        }),
      })
    );
  });

  it("deduplicates tenants between concrete and template branches", async () => {
    const sharedTenantId = generateId<TenantId>();
    const sharedTenant = { ...getMockedApiTenant(), id: sharedTenantId };
    const concrete = buildConcreteFixture("2026-01-01T00:00:00.000Z");
    const template = buildTemplateFixture("2026-02-01T00:00:00.000Z");
    concrete.eservice.producerId = sharedTenantId;
    template.eserviceTemplate.creatorId = sharedTenantId;

    const getTenant = vi.fn().mockResolvedValue(sharedTenant);

    const { service } = buildService({
      getPurposeTemplateEServices: vi.fn().mockResolvedValue({
        results: [concrete.link],
        totalCount: 1,
      }),
      getPurposeTemplateEServiceTemplates: vi.fn().mockResolvedValue({
        results: [template.link],
        totalCount: 1,
      }),
      getEServices: vi.fn().mockResolvedValue({ results: [concrete.eservice] }),
      getEServiceTemplates: vi
        .fn()
        .mockResolvedValue({ results: [template.eserviceTemplate] }),
      getTenant,
    });

    await service.getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds: [],
      offset: 0,
      limit: 10,
      ctx,
    });

    expect(getTenant).toHaveBeenCalledTimes(1);
    expect(getTenant).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: sharedTenantId } })
    );
  });

  it("short-circuits enrichment calls when there are no links", async () => {
    const { service, mocks } = buildService({});

    const result = await service.getPurposeTemplateLinkableResources({
      purposeTemplateId,
      publisherIds: [],
      offset: 0,
      limit: 10,
      ctx,
    });

    expect(result).toEqual({
      results: [],
      pagination: { offset: 0, limit: 10, totalCount: 0 },
    });
    expect(mocks.getEServices).toHaveBeenCalledTimes(0);
    expect(mocks.getEServiceTemplates).toHaveBeenCalledTimes(0);
    expect(mocks.getTenant).toHaveBeenCalledTimes(0);
  });

  it("throws eServiceNotFound when the eservice is missing from the batch", async () => {
    const concrete = buildConcreteFixture("2026-01-01T00:00:00.000Z");

    const { service } = buildService({
      getPurposeTemplateEServices: vi.fn().mockResolvedValue({
        results: [concrete.link],
        totalCount: 1,
      }),
      // intentionally empty results
      getEServices: vi.fn().mockResolvedValue({ results: [] }),
    });

    await expect(
      service.getPurposeTemplateLinkableResources({
        purposeTemplateId,
        publisherIds: [],
        offset: 0,
        limit: 10,
        ctx,
      })
    ).rejects.toThrow(eServiceNotFound(concrete.link.eserviceId).message);
  });

  it("throws eserviceDescriptorNotFound when the descriptor is missing inside the eservice", async () => {
    const concrete = buildConcreteFixture("2026-01-01T00:00:00.000Z");
    const eserviceWithoutDescriptor = {
      ...concrete.eservice,
      descriptors: [],
    };

    const { service } = buildService({
      getPurposeTemplateEServices: vi.fn().mockResolvedValue({
        results: [concrete.link],
        totalCount: 1,
      }),
      getEServices: vi
        .fn()
        .mockResolvedValue({ results: [eserviceWithoutDescriptor] }),
      getTenant: vi.fn().mockResolvedValue(concrete.tenant),
    });

    await expect(
      service.getPurposeTemplateLinkableResources({
        purposeTemplateId,
        publisherIds: [],
        offset: 0,
        limit: 10,
        ctx,
      })
    ).rejects.toThrow(
      eserviceDescriptorNotFound(concrete.eservice.id, concrete.descriptor.id)
        .message
    );
  });

  it("throws eserviceTemplateNotFound when the template is missing from the batch", async () => {
    const template = buildTemplateFixture("2026-01-01T00:00:00.000Z");

    const { service } = buildService({
      getPurposeTemplateEServiceTemplates: vi.fn().mockResolvedValue({
        results: [template.link],
        totalCount: 1,
      }),
      getEServiceTemplates: vi.fn().mockResolvedValue({ results: [] }),
    });

    await expect(
      service.getPurposeTemplateLinkableResources({
        purposeTemplateId,
        publisherIds: [],
        offset: 0,
        limit: 10,
        ctx,
      })
    ).rejects.toThrow(
      eserviceTemplateNotFound(template.link.eserviceTemplateId).message
    );
  });

  it("throws eserviceTemplateVersionNotFound when the version is missing inside the template", async () => {
    const template = buildTemplateFixture("2026-01-01T00:00:00.000Z");
    const templateWithoutVersion = {
      ...template.eserviceTemplate,
      versions: [],
    };

    const { service } = buildService({
      getPurposeTemplateEServiceTemplates: vi.fn().mockResolvedValue({
        results: [template.link],
        totalCount: 1,
      }),
      getEServiceTemplates: vi
        .fn()
        .mockResolvedValue({ results: [templateWithoutVersion] }),
      getTenant: vi.fn().mockResolvedValue(template.tenant),
    });

    await expect(
      service.getPurposeTemplateLinkableResources({
        purposeTemplateId,
        publisherIds: [],
        offset: 0,
        limit: 10,
        ctx,
      })
    ).rejects.toThrow(
      eserviceTemplateVersionNotFound(
        template.link.eserviceTemplateId,
        template.link.eserviceTemplateVersionId
      ).message
    );
  });

  it("throws tenantNotFound when the publisher tenant is missing from the lookup map", async () => {
    const concrete = buildConcreteFixture("2026-01-01T00:00:00.000Z");
    // Process returns a tenant whose id does not match the requested producerId,
    // so the Map.get(producerId) lookup in enrichLinkableResourcePage falls through.
    const decoyTenant = { ...getMockedApiTenant() };

    const { service } = buildService({
      getPurposeTemplateEServices: vi.fn().mockResolvedValue({
        results: [concrete.link],
        totalCount: 1,
      }),
      getEServices: vi.fn().mockResolvedValue({ results: [concrete.eservice] }),
      getTenant: vi.fn().mockResolvedValue(decoyTenant),
    });

    await expect(
      service.getPurposeTemplateLinkableResources({
        purposeTemplateId,
        publisherIds: [],
        offset: 0,
        limit: 10,
        ctx,
      })
    ).rejects.toThrow(tenantNotFound(concrete.eservice.producerId).message);
  });
});
