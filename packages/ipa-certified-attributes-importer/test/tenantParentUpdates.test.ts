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

const rootTenant = tenantOf("ROOT");
const aooTenant = tenantOf("AOO1");
const directUoTenant = tenantOf("UO1");
const uoNoAooTenant = tenantOf("UO2");

const aooInstitution = institution("AOO", "AOO1", {
  rootOriginId: "ROOT",
  parentOriginId: "ROOT",
});
const directUoInstitution = institution("UO", "UO1", {
  rootOriginId: "ROOT",
  aooOriginId: "AOO1",
  parentOriginId: "AOO1",
});
const uoNoAooInstitution = institution("UO", "UO2", {
  rootOriginId: "ROOT",
  parentOriginId: "ROOT",
});

describe("getTenantParentUpdates", () => {
  const tenants = buildTenantsIndex([
    rootTenant,
    aooTenant,
    directUoTenant,
    uoNoAooTenant,
  ]);

  it("computes parent and root ids, AOO before UO, skipping agencies", () => {
    const updates = getTenantParentUpdates(
      {
        institutions: [
          institution("Agency", "ROOT"),
          aooInstitution,
          directUoInstitution,
          uoNoAooInstitution,
        ],
        attributes: [],
      },
      tenants
    );

    expect(updates).toEqual([
      {
        tenant: aooTenant,
        parentTenantId: rootTenant.id,
        rootTenantId: rootTenant.id,
      },
      {
        tenant: directUoTenant,
        parentTenantId: aooTenant.id,
        rootTenantId: rootTenant.id,
      },
      {
        tenant: uoNoAooTenant,
        parentTenantId: rootTenant.id,
        rootTenantId: rootTenant.id,
      },
    ]);
  });

  it("resets both ids when the parent is missing", () => {
    const updates = getTenantParentUpdates(
      { institutions: [directUoInstitution], attributes: [] },
      buildTenantsIndex([rootTenant, directUoTenant])
    );
    expect(updates).toEqual([
      { tenant: directUoTenant, parentTenantId: null, rootTenantId: null },
    ]);
  });

  it("resets both ids when the root is missing", () => {
    const updates = getTenantParentUpdates(
      { institutions: [directUoInstitution], attributes: [] },
      buildTenantsIndex([aooTenant, directUoTenant])
    );
    expect(updates).toEqual([
      { tenant: directUoTenant, parentTenantId: null, rootTenantId: null },
    ]);
  });

  it("excludes AOO/UO not onboarded", () => {
    expect(
      getTenantParentUpdates(
        { institutions: [aooInstitution, directUoInstitution], attributes: [] },
        buildTenantsIndex([rootTenant])
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
