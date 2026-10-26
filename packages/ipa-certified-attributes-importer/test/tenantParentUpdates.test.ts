import { genericLogger } from "pagopa-interop-commons";
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  generateId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import type { Institution } from "../src/services/openDataExtractor.js";

import {
  buildTenantsIndex,
  getTenantParentUpdates,
  updateTenantsParent,
} from "../src/services/ipaCertifiedAttributesImporterService.js";

const origin = PUBLIC_ADMINISTRATIONS_IDENTIFIER;

const tenantOf = (value: string): Tenant => ({
  ...getMockTenant(),
  id: generateId(),
  externalId: { origin, value },
});

const institution = (
  classification: Institution["classification"],
  originId: string,
  rest: Partial<Institution> = {}
): Institution => ({
  id: `tax-${originId}`,
  originId,
  category: "c",
  description: "d",
  origin,
  kind: "k",
  classification,
  ...rest,
});

const root = tenantOf("ROOT");
const aooTenant = tenantOf("AOO1");
const uoTenant = tenantOf("UO1");
const uoNoAooTenant = tenantOf("UO2");

const aooInst = institution("AOO", "AOO1", {
  rootOriginId: "ROOT",
  parentOriginId: "ROOT",
});
const uoInst = institution("UO", "UO1", {
  rootOriginId: "ROOT",
  aooOriginId: "AOO1",
  parentOriginId: "AOO1",
});
const uoNoAooInst = institution("UO", "UO2", {
  rootOriginId: "ROOT",
  parentOriginId: "ROOT",
});

describe("getTenantParentUpdates", () => {
  const tenants = buildTenantsIndex([root, aooTenant, uoTenant, uoNoAooTenant]);

  it("computes parent and root ids, AOO before UO, skipping agencies", () => {
    const updates = getTenantParentUpdates(
      {
        institutions: [
          institution("Agency", "ROOT"),
          aooInst,
          uoInst,
          uoNoAooInst,
        ],
        attributes: [],
      },
      tenants
    );

    expect(updates).toEqual([
      { tenant: aooTenant, parentTenantId: root.id, rootTenantId: root.id },
      { tenant: uoTenant, parentTenantId: aooTenant.id, rootTenantId: root.id },
      {
        tenant: uoNoAooTenant,
        parentTenantId: root.id,
        rootTenantId: root.id,
      },
    ]);
  });

  it("resets both ids when the parent is missing", () => {
    const updates = getTenantParentUpdates(
      { institutions: [uoInst], attributes: [] },
      buildTenantsIndex([root, uoTenant])
    );
    expect(updates).toEqual([
      { tenant: uoTenant, parentTenantId: null, rootTenantId: null },
    ]);
  });

  it("resets both ids when the root is missing", () => {
    const updates = getTenantParentUpdates(
      { institutions: [uoInst], attributes: [] },
      buildTenantsIndex([aooTenant, uoTenant])
    );
    expect(updates).toEqual([
      { tenant: uoTenant, parentTenantId: null, rootTenantId: null },
    ]);
  });

  it("excludes AOO/UO not onboarded", () => {
    expect(
      getTenantParentUpdates(
        { institutions: [aooInst, uoInst], attributes: [] },
        buildTenantsIndex([root])
      )
    ).toEqual([]);
  });
});

describe("updateTenantsParent", () => {
  it("calls internalUpdateTenantParent with the tenant external id, ids (null included) and headers", async () => {
    const parent = tenantOf("ROOT");
    const child = tenantOf("UO1");
    const orphan = tenantOf("UO2");
    const headers = {
      "X-Correlation-Id": generateId(),
      Authorization: "Bearer token",
    };

    const internalUpdateTenantParent = vi
      .fn()
      .mockResolvedValue({ data: child, metadata: { version: 1 } });
    const getTenantByExternalIdWithMetadata = vi
      .fn()
      .mockResolvedValue({ data: child, metadata: { version: 1 } });

    const failures = await updateTenantsParent(
      [
        { tenant: child, parentTenantId: parent.id, rootTenantId: parent.id },
        { tenant: orphan, parentTenantId: null, rootTenantId: null },
      ],
      { internalUpdateTenantParent } as unknown as Parameters<
        typeof updateTenantsParent
      >[1],
      { getTenantByExternalIdWithMetadata } as unknown as Parameters<
        typeof updateTenantsParent
      >[2],
      headers as unknown as Parameters<typeof updateTenantsParent>[3],
      genericLogger,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 }
    );

    expect(failures).toBe(0);
    expect(internalUpdateTenantParent).toHaveBeenCalledTimes(2);
    expect(internalUpdateTenantParent).toHaveBeenNthCalledWith(
      1,
      { parentTenantId: parent.id, rootTenantId: parent.id },
      { params: { tOrigin: origin, tExternalId: "UO1" }, headers }
    );
    expect(internalUpdateTenantParent).toHaveBeenNthCalledWith(
      2,
      { parentTenantId: null, rootTenantId: null },
      { params: { tOrigin: origin, tExternalId: "UO2" }, headers }
    );
  });
});
