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

describe("tenant hierarchy name filter", () => {
  it.each([
    { direct: true, query: "unit - Institution", matches: true },
    { direct: true, query: "unit - Institution - Institution", matches: false },
    { direct: false, query: "unit - Area - Institution", matches: true },
    { direct: false, query: "unit - Institution", matches: false },
  ])(
    "matches composed names without duplicating ancestors: %j",
    async ({ direct, query, matches }) => {
      const root = { ...getMockTenant(), name: "Institution" };
      const parent: Tenant = {
        ...getMockTenant(),
        name: "Area",
        subUnitType: "AOO",
      };
      const unit: Tenant = {
        ...getMockTenant(),
        name: "unit",
        subUnitType: "UO",
        parentTenantId: direct ? root.id : parent.id,
        rootTenantId: root.id,
      };
      for (const tenant of [root, parent, unit]) {
        await upsertTenant(readModelDB, tenant, 0);
      }
      const result = await readModelService.getTenants({
        name: query,
        features: [],
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        offset: 0,
        limit: 50,
      });
      expect(result.results.map((tenant) => tenant.id)).toEqual(
        matches ? [unit.id] : []
      );
      expect(result.totalCount).toBe(matches ? 1 : 0);
    }
  );

  it("applies hierarchy search before pagination and total count", async () => {
    const root = { ...getMockTenant(), name: "Institution" };
    const units: Tenant[] = ["Alpha", "Beta", "Gamma"].map((name) => ({
      ...getMockTenant(),
      name,
      subUnitType: "UO",
      parentTenantId: root.id,
      rootTenantId: root.id,
      externalId: { origin: "HIERARCHY", value: name },
    }));
    for (const tenant of [root, ...units]) {
      await upsertTenant(readModelDB, tenant, 0);
    }
    const result = await readModelService.getTenants({
      name: "institution",
      features: [],
      externalIdOrigin: "HIERARCHY",
      externalIdValue: undefined,
      offset: 1,
      limit: 1,
    });
    expect(result.totalCount).toBe(3);
    expect(result.results.map((tenant) => tenant.id)).toEqual([units[1].id]);
  });

  it.each(["%", "_"])("escapes %s in ancestor names", async (character) => {
    const root = { ...getMockTenant(), name: `Institution ${character}` };
    const unrelated = { ...getMockTenant(), name: "Institution X" };
    const unit: Tenant = {
      ...getMockTenant(),
      name: "Unit",
      parentTenantId: root.id,
      rootTenantId: root.id,
    };
    for (const tenant of [root, unrelated, unit]) {
      await upsertTenant(readModelDB, tenant, 0);
    }
    const result = await readModelService.getTenants({
      name: `Institution ${character}`,
      features: [],
      externalIdOrigin: undefined,
      externalIdValue: undefined,
      offset: 0,
      limit: 50,
    });
    expect(result.totalCount).toBe(2);
    expect(result.results.map((tenant) => tenant.id).sort()).toEqual(
      [root.id, unit.id].sort()
    );
  });

  it.each([
    "root",
    "identical parent and root",
    "parent and root",
    "missing parent",
    "missing root",
    "empty ancestor name",
  ])("uses joined ancestors without a separate query: %s", async (scenario) => {
    const root: Tenant = { ...getMockTenant(), name: "Root" };
    const parent: Tenant = {
      ...getMockTenant(),
      name: scenario === "empty ancestor name" ? "" : "Parent",
      subUnitType: "AOO",
    };
    const unit: Tenant = {
      ...getMockTenant(),
      parentTenantId: match(scenario)
        .with("root", () => undefined)
        .with("identical parent and root", () => root.id)
        .with("missing parent", () => generateId<TenantId>())
        .otherwise(() => parent.id),
      rootTenantId: match(scenario)
        .with("root", () => undefined)
        .with("missing root", () => generateId<TenantId>())
        .otherwise(() => root.id),
      externalId: { origin: "HIERARCHY", value: "chosen" },
    };
    for (const tenant of [root, parent, unit]) {
      await upsertTenant(readModelDB, tenant, 0);
    }
    const parentSummary: ParentTenant = {
      id: parent.id,
      name: parent.name,
      subUnitType: parent.subUnitType,
    };
    const rootSummary: ParentTenant = { id: root.id, name: root.name };
    const expected = match(scenario)
      .with("root", "missing parent", () => undefined)
      .with("identical parent and root", () => rootSummary)
      .with("missing root", () => parentSummary)
      .otherwise(() => ({ ...parentSummary, parentTenant: rootSummary }));
    const select = vi.spyOn(readModelDB, "select");
    try {
      const result = await readModelService.getTenants({
        name: undefined,
        features: [],
        externalIdOrigin: "HIERARCHY",
        externalIdValue: "chosen",
        offset: 0,
        limit: 1,
      });
      expect(result.totalCount).toBe(1);
      expect(result.results).toEqual([{ ...unit, parentTenant: expected }]);
      expect(select).not.toHaveBeenCalled();
    } finally {
      select.mockRestore();
    }
  });

  it.each([
    "Hierarchy unit",
    "Hierarchy area",
    "Hierarchy institution",
    "Hierarchy unit - Hierarchy area - Hierarchy institution",
    "hierarchy unit - hierarchy area",
    "absent",
  ])(
    "matches %s while retaining feature, external-ID and onboarding filters",
    async (name) => {
      const root = { ...getMockTenant(), name: "Hierarchy institution" };
      const parent = { ...getMockTenant(), name: "Hierarchy area" };
      const unit: Tenant = {
        ...getMockTenant(),
        name: "Hierarchy unit",
        parentTenantId: parent.id,
        rootTenantId: root.id,
        externalId: { origin: "HIERARCHY", value: "chosen" },
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      const excluded: Tenant[] = [
        { ...unit, id: getMockTenant().id, features: [] },
        { ...unit, id: getMockTenant().id, selfcareId: undefined },
        {
          ...unit,
          id: getMockTenant().id,
          externalId: { origin: "OTHER", value: "chosen" },
        },
        {
          ...unit,
          id: getMockTenant().id,
          externalId: { origin: "HIERARCHY", value: "other" },
        },
        {
          ...unit,
          id: getMockTenant().id,
          name: "Unrelated",
          parentTenantId: undefined,
          rootTenantId: undefined,
        },
      ];
      for (const tenant of [root, parent, unit, ...excluded]) {
        await upsertTenant(readModelDB, tenant, 0);
      }
      const result = await readModelService.getTenants({
        name,
        features: [tenantFeatureType.delegatedProducer],
        externalIdOrigin: "HIERARCHY",
        externalIdValue: "chosen",
        offset: 0,
        limit: 50,
      });
      expect(result.totalCount).toBe(name === "absent" ? 0 : 1);
      expect(result.results.map((tenant) => tenant.id)).toEqual(
        name === "absent" ? [] : [unit.id]
      );
      if (name !== "absent") {
        expect(result.results[0].parentTenant?.id).toBe(parent.id);
        expect(result.results[0].parentTenant?.parentTenant?.id).toBe(root.id);
      }
    }
  );

  it("searches tenant and ancestor names and returns hierarchy", async () => {
    const root = { ...getMockTenant(), name: "Institution" };
    const parent: Tenant = {
      ...getMockTenant(),
      name: "Area",
      subUnitType: "AOO",
    };
    const unit: Tenant = {
      ...getMockTenant(),
      name: "Unit",
      parentTenantId: parent.id,
      rootTenantId: root.id,
    };
    for (const tenant of [root, parent, unit]) {
      await upsertTenant(readModelDB, tenant, 0);
    }

    const result = await readModelService.getTenants({
      name: "Institution",
      features: [],
      externalIdOrigin: undefined,
      externalIdValue: undefined,
      offset: 0,
      limit: 10,
    });

    expect(result.results.map((tenant) => tenant.id)).toEqual([
      root.id,
      unit.id,
    ]);
    expect(result.results[1].parentTenant).toEqual({
      id: parent.id,
      name: parent.name,
      subUnitType: "AOO",
      parentTenant: { id: root.id, name: root.name },
    });
  });
});

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
});
