import { describe, expect, it } from "vitest";
import { Tenant, tenantFeatureType } from "pagopa-interop-models";
import { getMockTenant } from "pagopa-interop-commons-test";
import { addOneTenant, readModelService } from "./utils.js";

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

      const tenantCertifier1 = {
        ...tenant3,
        features: [
          {
            type: tenantFeatureType.persistentCertifier,
            certifierId: "certifierId",
          },
        ],
      };

      await addOneTenant(tenantCertifier1);
      await addOneTenant(tenant4);

      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [tenantFeatureType.delegatedProducer],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(2);
      expect(tenantsByName.results).toEqual([
        tenantDelegatedProducer1,
        tenantDelegatedProducer2,
      ]);
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

      const tenantCertifier1 = {
        ...tenant3,
        features: [
          {
            type: tenantFeatureType.persistentCertifier,
            certifierId: "certifierId",
          },
        ],
      };

      await addOneTenant(tenantCertifier1);
      await addOneTenant(tenant4);

      const tenantsByName = await readModelService.getTenants({
        name: "Tenant 2",
        features: [
          tenantFeatureType.delegatedProducer,
          tenantFeatureType.persistentCertifier,
        ],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(1);
      expect(tenantsByName.results).toEqual([tenantDelegatedProducer2]);
    });
    it("should not get tenants if there are not any tenants", async () => {
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
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
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(0);
      expect(tenantsByName.results).toEqual([]);
    });
    it("should get a maximun number of tenants based on a specified limit", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        offset: 0,
        limit: 4,
      });
      expect(tenantsByName.results.length).toBe(4);
    });
    it("should get a maximun number of tenants based on a specified limit and offset", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        offset: 2,
        limit: 4,
      });
      expect(tenantsByName.results.length).toBe(3);
    });
  });
});
