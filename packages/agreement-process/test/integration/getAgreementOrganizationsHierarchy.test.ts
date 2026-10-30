import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";

import {
  addOneAgreement,
  addOneTenant,
  agreementService,
} from "../integrationUtils.js";

describe("agreement organization hierarchy filters", () => {
  it.each([
    "Hierarchy unit",
    "Hierarchy area",
    "Hierarchy institution",
    "absent",
  ])("matches %s without widening requester visibility", async (name) => {
    const requester = getMockTenant();
    const root = { ...getMockTenant(), name: "Hierarchy institution" };
    const parent = {
      ...getMockTenant(),
      name: "Hierarchy area",
      parentTenantId: root.id,
      rootTenantId: root.id,
    };
    const unit = {
      ...getMockTenant(),
      name: "Hierarchy unit",
      parentTenantId: parent.id,
      rootTenantId: root.id,
    };
    const hidden = { ...unit, id: getMockTenant().id };
    const unrelated = { ...getMockTenant(), name: "Unrelated" };
    for (const tenant of [requester, root, parent, unit, hidden, unrelated]) {
      await addOneTenant(tenant);
    }
    for (const tenant of [unit, unrelated]) {
      await addOneAgreement({
        ...getMockAgreement(),
        producerId: requester.id,
        consumerId: tenant.id,
      });
      await addOneAgreement({
        ...getMockAgreement(),
        producerId: tenant.id,
        consumerId: requester.id,
      });
    }
    await addOneAgreement({
      ...getMockAgreement(),
      producerId: hidden.id,
      consumerId: hidden.id,
    });
    const context = getMockContext({ authData: getMockAuthData(requester.id) });
    const consumers = await agreementService.getAgreementsConsumers(
      name,
      50,
      0,
      context
    );
    const producers = await agreementService.getAgreementsProducers(
      name,
      50,
      0,
      context
    );
    for (const result of [consumers, producers]) {
      expect(result.totalCount).toBe(name === "absent" ? 0 : 1);
      expect(result.results.map((tenant) => tenant.id)).toEqual(
        name === "absent" ? [] : [unit.id]
      );
      if (name !== "absent") {
        expect(result.results[0].parentTenant?.id).toBe(parent.id);
        expect(result.results[0].parentTenant?.parentTenant?.id).toBe(root.id);
      }
    }
  });
});
