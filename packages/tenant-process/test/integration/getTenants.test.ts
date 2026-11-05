import { getMockTenant } from "pagopa-interop-commons-test";
import {
  generateId,
  ParentTenant,
  Tenant,
  TenantId,
  tenantFeatureType,
} from "pagopa-interop-models";
import { upsertTenant } from "pagopa-interop-readmodel/testUtils";
import { match } from "ts-pattern";
import { describe, expect, it, vi } from "vitest";

import {
  addOneTenant,
  readModelDB,
  readModelService,
} from "../integrationUtils.js";

describe("getTenants", () => {
  const tenant1: Tenant = {
    ...getMockTenant(),
    name: "Tenant 1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    name: "Tenant 2",
  };
  const tenant3: Tenant = {
    ...getMockTenant(),
    name: "Tenant 3",
  };
  const tenant4: Tenant = {
    ...getMockTenant(),
    name: "Tenant 4",
  };
  const tenant5: Tenant = {
    ...getMockTenant(),
    name: "Tenant 5",
  };
  describe("getTenants", () => {
    it("should get all the tenants with no filter", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);

      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(3);
      expect(tenantsByName.results).toEqual([tenant1, tenant2, tenant3]);
    });
    it("should get tenants by name", async () => {
      await addOneTenant(tenant1);

      await addOneTenant(tenant2);

      const tenantsByName = await readModelService.getTenants({
        name: "Tenant 1",
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(1);
      expect(tenantsByName.results).toEqual([tenant1]);
    });
    it("should get tenants by feature", async () => {
      const tenantDelegatedProducer1: Tenant = {
        ...tenant1,
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedProducer1);

      const tenantDelegatedProducer2: Tenant = {
        ...tenant2,
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedProducer2);

      const tenantDelegatedConsumer1: Tenant = {
        ...tenant3,
        features: [
          {
            type: tenantFeatureType.delegatedConsumer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedConsumer1);

      const tenantDelegatedConsumer2: Tenant = {
        ...tenant4,
        features: [
          {
            type: tenantFeatureType.delegatedConsumer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedConsumer2);

      const tenantCertifier1 = {
        ...tenant5,
        features: [
          {
            type: tenantFeatureType.persistentCertifier,
            certifierId: "certifierId",
          },
        ],
      };

      await addOneTenant(tenantCertifier1);

      const tenantsByDelegatedProducerFeature =
        await readModelService.getTenants({
          name: undefined,
          features: [tenantFeatureType.delegatedProducer],
          externalIdOrigin: undefined,
          externalIdValue: undefined,
          offset: 0,
          limit: 50,
        });
      expect(tenantsByDelegatedProducerFeature.totalCount).toBe(2);
      expect(tenantsByDelegatedProducerFeature.results).toEqual([
        tenantDelegatedProducer1,
        tenantDelegatedProducer2,
      ]);

      const tenantsByDelegatedConsumerFeature =
        await readModelService.getTenants({
          name: undefined,
          features: [tenantFeatureType.delegatedConsumer],
          externalIdOrigin: undefined,
          externalIdValue: undefined,
          offset: 0,
          limit: 50,
        });
      expect(tenantsByDelegatedConsumerFeature.totalCount).toBe(2);
      expect(tenantsByDelegatedConsumerFeature.results).toEqual([
        tenantDelegatedConsumer1,
        tenantDelegatedConsumer2,
      ]);

      const tenantsByCertifierFeature = await readModelService.getTenants({
        name: undefined,
        features: [tenantFeatureType.persistentCertifier],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByCertifierFeature.totalCount).toBe(1);
      expect(tenantsByCertifierFeature.results).toEqual([tenantCertifier1]);

      const allTenants = await readModelService.getTenants({
        name: undefined,
        features: [
          tenantFeatureType.delegatedProducer,
          tenantFeatureType.delegatedConsumer,
          tenantFeatureType.persistentCertifier,
        ],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(allTenants.totalCount).toBe(5);
    });
    it("should get tenants by feature and name", async () => {
      const tenantDelegatedProducer1: Tenant = {
        ...tenant1,
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedProducer1);

      const tenantDelegatedProducer2: Tenant = {
        ...tenant2,
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedProducer2);

      const tenantDelegatedConsumer1: Tenant = {
        ...tenant3,
        features: [
          {
            type: tenantFeatureType.delegatedConsumer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedConsumer1);

      const tenantCertifier1 = {
        ...tenant4,
        features: [
          {
            type: tenantFeatureType.persistentCertifier,
            certifierId: "certifierId",
          },
        ],
      };

      await addOneTenant(tenantCertifier1);
      await addOneTenant(tenant5);

      const tenantsByName = await readModelService.getTenants({
        name: "Tenant 2",
        features: [
          tenantFeatureType.delegatedProducer,
          tenantFeatureType.persistentCertifier,
        ],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(1);
      expect(tenantsByName.results).toEqual([tenantDelegatedProducer2]);

      const tenantsByName2 = await readModelService.getTenants({
        name: "Tenant",
        features: [tenantFeatureType.delegatedProducer],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName2.totalCount).toBe(2);
      expect(tenantsByName2.results).toEqual([
        tenantDelegatedProducer1,
        tenantDelegatedProducer2,
      ]);

      const tenantsByName3 = await readModelService.getTenants({
        name: "Tenant 3",
        features: [tenantFeatureType.delegatedConsumer],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName3.totalCount).toBe(1);
      expect(tenantsByName3.results).toEqual([tenantDelegatedConsumer1]);

      const tenantsByName4 = await readModelService.getTenants({
        name: "Noname",
        features: [tenantFeatureType.persistentCertifier],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName4.totalCount).toBe(0);
    });
    it("should not get tenants if there are not any tenants", async () => {
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(0);
      expect(tenantsByName.results).toEqual([]);
    });
    it("should not get tenants if the name does not match", async () => {
      await addOneTenant(tenant1);

      await addOneTenant(tenant2);

      const tenantsByName = await readModelService.getTenants({
        name: "Tenant 6",
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(0);
      expect(tenantsByName.results).toEqual([]);
    });
    it("should get a maximum number of tenants based on a specified limit", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 4,
      });
      expect(tenantsByName.results.length).toBe(4);
    });
    it("should get a maximum number of tenants based on a specified limit and offset", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 2,
        limit: 4,
      });
      expect(tenantsByName.results.length).toBe(3);
    });
    it("should get the tenants by externalIdOrigin", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);

      const tenant6: Tenant = {
        ...getMockTenant(),
        name: "Tenant 6",
        externalId: {
          origin: "externalIdOrigin1",
          value: "externalIdValue1",
        },
      };
      const tenant7: Tenant = {
        ...getMockTenant(),
        name: "Tenant 7",
        externalId: {
          origin: "externalIdOrigin1",
          value: "externalIdValue1",
        },
      };

      await addOneTenant(tenant6);
      await addOneTenant(tenant7);

      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        externalIdOrigin: tenant6.externalId.origin,
        externalIdValue: undefined,
        offset: 0,
        limit: 20,
      });
      expect(tenantsByName.results.length).toBe(2);
      expect(tenantsByName.results).toEqual([tenant6, tenant7]);
    });
    it("should get the tenants by externalIdValue", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);

      const tenant6: Tenant = {
        ...getMockTenant(),
        name: "Tenant 6",
        externalId: {
          origin: "externalIdOrigin1",
          value: "externalIdValue1",
        },
      };
      const tenant7: Tenant = {
        ...getMockTenant(),
        name: "Tenant 7",
        externalId: {
          origin: "externalIdOrigin1",
          value: "externalIdValue1",
        },
      };

      await addOneTenant(tenant6);
      await addOneTenant(tenant7);

      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: tenant6.externalId.value,
        offset: 0,
        limit: 20,
      });
      expect(tenantsByName.results.length).toBe(2);
      expect(tenantsByName.results).toEqual([tenant6, tenant7]);
    });
    it("should get the tenants by externalIdOrigin and externalIdValue", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);

      const tenant6: Tenant = {
        ...getMockTenant(),
        name: "Tenant 6",
        externalId: {
          origin: "externalIdOrigin1",
          value: "externalIdValue1",
        },
      };

      const tenant7: Tenant = {
        ...getMockTenant(),
        name: "Tenant 7",
        externalId: {
          origin: "externalIdOrigin1",
          value: "externalIdValue1",
        },
      };

      const tenant8: Tenant = {
        ...getMockTenant(),
        name: "Tenant 8",
        externalId: {
          origin: "externalIdOrigin1",
          value: "externalIdValue2 ",
        },
      };

      await addOneTenant(tenant6);
      await addOneTenant(tenant7);
      await addOneTenant(tenant8);

      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        externalIdOrigin: tenant6.externalId.origin,
        externalIdValue: tenant6.externalId.value,
        offset: 0,
        limit: 20,
      });
      expect(tenantsByName.results.length).toBe(2);
      expect(tenantsByName.results).toEqual([tenant6, tenant7]);
    });
  });

  it.each([
    { direct: true, query: "Tenant UO - Tenant root", matches: true },
    {
      direct: true,
      query: "Tenant UO - Tenant root - Tenant root",
      matches: false,
    },
    {
      direct: false,
      query: "Tenant UO - Tenant AOO - Tenant root",
      matches: true,
    },
    {
      direct: false,
      query: "Tenant UO - Tenant root",
      matches: false,
    },
  ])(
    "should search by composed name without duplicating ancestors: %j",
    async ({ direct, query, matches }) => {
      const rootTenant = { ...getMockTenant(), name: "Tenant root" };
      const parentTenant: Tenant = {
        ...getMockTenant(),
        name: "Tenant AOO",
        subUnitType: "AOO",
      };
      const targetTenant: Tenant = {
        ...getMockTenant(),
        name: "Tenant UO",
        subUnitType: "UO",
        parentTenantId: direct ? rootTenant.id : parentTenant.id,
        rootTenantId: rootTenant.id,
      };
      for (const tenant of [rootTenant, parentTenant, targetTenant]) {
        await upsertTenant(readModelDB, tenant, 0);
      }
      const tenantsMatchingQuery = await readModelService.getTenants({
        name: query,
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsMatchingQuery.results.map((tenant) => tenant.id)).toEqual(
        matches ? [targetTenant.id] : []
      );
      expect(tenantsMatchingQuery.totalCount).toBe(matches ? 1 : 0);
    }
  );

  it("should apply name search before pagination and total count", async () => {
    const rootTenant = { ...getMockTenant(), name: "Tenant root" };
    const targetTenants: Tenant[] = ["Alpha", "Beta", "Gamma"].map((name) => ({
      ...getMockTenant(),
      name,
      subUnitType: "UO",
      parentTenantId: rootTenant.id,
      rootTenantId: rootTenant.id,
      externalId: { origin: "HIERARCHY", value: name },
    }));
    for (const tenant of [rootTenant, ...targetTenants]) {
      await upsertTenant(readModelDB, tenant, 0);
    }
    const paginatedTenants = await readModelService.getTenants({
      name: "tenant root",
      features: [],
      externalIdOrigin: "HIERARCHY",
      externalIdValue: undefined,
      offset: 1,
      limit: 1,
    });
    expect(paginatedTenants.totalCount).toBe(3);
    expect(paginatedTenants.results.map((tenant) => tenant.id)).toEqual([
      targetTenants[1].id,
    ]);
  });

  it.each(["%", "_"])(
    "should escape %s in ancestor names during name search",
    async (character) => {
      const rootTenant = {
        ...getMockTenant(),
        name: `Tenant root ${character}`,
      };
      const nonMatchingTenant = {
        ...getMockTenant(),
        name: "Tenant root X",
      };
      const targetTenant: Tenant = {
        ...getMockTenant(),
        name: "Tenant UO",
        parentTenantId: rootTenant.id,
        rootTenantId: rootTenant.id,
      };
      for (const tenant of [rootTenant, nonMatchingTenant, targetTenant]) {
        await upsertTenant(readModelDB, tenant, 0);
      }
      const tenantsMatchingEscapedAncestorName =
        await readModelService.getTenants({
          name: `Tenant root ${character}`,
          features: [],
          externalIdOrigin: undefined,
          externalIdValue: undefined,
          offset: 0,
          limit: 50,
        });
      expect(tenantsMatchingEscapedAncestorName.totalCount).toBe(2);
      expect(
        tenantsMatchingEscapedAncestorName.results
          .map((tenant) => tenant.id)
          .sort()
      ).toEqual([rootTenant.id, targetTenant.id].sort());
    }
  );

  it.each([
    "root",
    "identical parent and root",
    "parent and root",
    "missing parent",
    "missing root",
    "empty ancestor name",
  ])(
    "should map joined parents without a separate query: %s",
    async (scenario) => {
      const rootTenant: Tenant = {
        ...getMockTenant(),
        name: "Tenant root",
      };
      const parentTenant: Tenant = {
        ...getMockTenant(),
        name: scenario === "empty ancestor name" ? "" : "Tenant AOO",
        subUnitType: "AOO",
      };
      const targetTenant: Tenant = {
        ...getMockTenant(),
        parentTenantId: match(scenario)
          .with("root", () => undefined)
          .with("identical parent and root", () => rootTenant.id)
          .with("missing parent", () => generateId<TenantId>())
          .otherwise(() => parentTenant.id),
        rootTenantId: match(scenario)
          .with("root", () => undefined)
          .with("missing root", () => generateId<TenantId>())
          .otherwise(() => rootTenant.id),
        externalId: { origin: "HIERARCHY", value: "chosen" },
      };
      for (const tenant of [rootTenant, parentTenant, targetTenant]) {
        await upsertTenant(readModelDB, tenant, 0);
      }
      const parentTenantSummary: ParentTenant = {
        id: parentTenant.id,
        name: parentTenant.name,
        subUnitType: parentTenant.subUnitType,
      };
      const rootTenantSummary: ParentTenant = {
        id: rootTenant.id,
        name: rootTenant.name,
      };
      const expected = match(scenario)
        .with("root", "missing parent", () => undefined)
        .with("identical parent and root", () => [rootTenantSummary])
        .with("missing root", () => [parentTenantSummary])
        .otherwise(() => [parentTenantSummary, rootTenantSummary]);
      const select = vi.spyOn(readModelDB, "select");
      try {
        const tenantsWithHierarchy = await readModelService.getTenants({
          name: undefined,
          features: [],
          externalIdOrigin: "HIERARCHY",
          externalIdValue: "chosen",
          offset: 0,
          limit: 1,
        });
        expect(tenantsWithHierarchy.totalCount).toBe(1);
        expect(tenantsWithHierarchy.results).toEqual([
          {
            ...targetTenant,
            ...(expected ? { parentTenants: expected } : {}),
          },
        ]);
        expect(select).not.toHaveBeenCalled();
      } finally {
        select.mockRestore();
      }
    }
  );

  it.each([
    { description: "parent name", query: "Tenant AOO", matches: true },
    {
      description: "unmatched name",
      query: "No matching tenant",
      matches: false,
    },
  ])(
    "should search by $description with feature, externalId, and selfcareId filters",
    async ({ query, matches }) => {
      const rootTenant = {
        ...getMockTenant(),
        name: "Tenant root",
      };
      const parentTenant = { ...getMockTenant(), name: "Tenant AOO" };
      const targetTenant: Tenant = {
        ...getMockTenant(),
        name: "Tenant UO",
        parentTenantId: parentTenant.id,
        rootTenantId: rootTenant.id,
        externalId: { origin: "HIERARCHY", value: "chosen" },
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      const excluded: Tenant[] = [
        { ...targetTenant, id: getMockTenant().id, features: [] },
        {
          ...targetTenant,
          id: getMockTenant().id,
          selfcareId: undefined,
        },
        {
          ...targetTenant,
          id: getMockTenant().id,
          externalId: { origin: "OTHER", value: "chosen" },
        },
        {
          ...targetTenant,
          id: getMockTenant().id,
          externalId: { origin: "HIERARCHY", value: "other" },
        },
        {
          ...targetTenant,
          id: getMockTenant().id,
          name: "Tenant unrelated",
          parentTenantId: undefined,
          rootTenantId: undefined,
        },
      ];
      for (const tenant of [
        rootTenant,
        parentTenant,
        targetTenant,
        ...excluded,
      ]) {
        await upsertTenant(readModelDB, tenant, 0);
      }
      const tenantsMatchingAllFilters = await readModelService.getTenants({
        name: query,
        features: [tenantFeatureType.delegatedProducer],
        externalIdOrigin: "HIERARCHY",
        externalIdValue: "chosen",
        offset: 0,
        limit: 50,
      });
      expect(tenantsMatchingAllFilters.totalCount).toBe(matches ? 1 : 0);
      expect(
        tenantsMatchingAllFilters.results.map((tenant) => tenant.id)
      ).toEqual(matches ? [targetTenant.id] : []);
      if (matches) {
        expect(
          tenantsMatchingAllFilters.results[0].parentTenants?.map(
            ({ id }) => id
          )
        ).toEqual([parentTenant.id, rootTenant.id]);
      }
    }
  );

  it("should search tenant and ancestor names and return parentTenants", async () => {
    const rootTenant = { ...getMockTenant(), name: "Tenant root" };
    const parentTenant: Tenant = {
      ...getMockTenant(),
      name: "Tenant AOO",
      subUnitType: "AOO",
    };
    const targetTenant: Tenant = {
      ...getMockTenant(),
      name: "Tenant UO",
      parentTenantId: parentTenant.id,
      rootTenantId: rootTenant.id,
    };
    for (const tenant of [rootTenant, parentTenant, targetTenant]) {
      await upsertTenant(readModelDB, tenant, 0);
    }

    const tenantsMatchingAncestorName = await readModelService.getTenants({
      name: "Tenant root",
      features: [],
      externalIdOrigin: undefined,
      externalIdValue: undefined,
      offset: 0,
      limit: 10,
    });

    expect(
      tenantsMatchingAncestorName.results.map((tenant) => tenant.id)
    ).toEqual([rootTenant.id, targetTenant.id]);
    expect(tenantsMatchingAncestorName.results[1].parentTenants).toEqual([
      {
        id: parentTenant.id,
        name: parentTenant.name,
        subUnitType: "AOO",
      },
      { id: rootTenant.id, name: rootTenant.name },
    ]);
  });
});
