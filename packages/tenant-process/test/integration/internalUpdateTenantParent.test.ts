/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  tenantUnitType,
  Tenant,
  toTenantV2,
  protobufDecoder,
  TenantParentUpdatedV2,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import { tenantNotFound } from "../../src/model/domain/errors.js";
import {
  aooTenantParentMustBeRootTenant,
  tenantCannotBeItsOwnParent,
  tenantIsNotAooOrUo,
  tenantParentRootReferencesMustBeBothSetOrNull,
  tenantRootMustBeMainInstitution,
  uoTenantParentMustBeRootTenantOrAooTenant,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  readLastTenantEvent,
  tenantService,
} from "../integrationUtils.js";

const callUpdate = (
  tenant: Tenant,
  parentTenantId: string | null,
  rootTenantId: string | null
) =>
  tenantService.internalUpdateTenantParent(
    {
      tenantOrigin: tenant.externalId.origin,
      tenantExternalId: tenant.externalId.value,
      parentTenantId,
      rootTenantId,
    },
    getMockContextInternal({})
  );

describe("internalUpdateTenantParent", () => {
  it("sets parent/root for an AOO and emits TenantParentUpdated", async () => {
    const root = getMockTenant();
    const aoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
    };
    await addOneTenant(root);
    await addOneTenant(aoo);

    const result = await callUpdate(aoo, root.id, root.id);

    expect(result.data.parentTenantId).toBe(root.id);
    expect(result.data.rootTenantId).toBe(root.id);
    expect(result.metadata.version).toBe(1);
    expect(await readLastTenantEvent(aoo.id)).toMatchObject({
      type: "TenantParentUpdated",
      version: "1",
    });
  });

  it("sets parent AOO and root for a UO", async () => {
    const root = getMockTenant();
    const aoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
      parentTenantId: root.id,
      rootTenantId: root.id,
    };
    const uo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.UO,
    };
    await addOneTenant(root);
    await addOneTenant(aoo);
    await addOneTenant(uo);

    const result = await callUpdate(uo, aoo.id, root.id);

    expect(result.data.parentTenantId).toBe(aoo.id);
    expect(result.data.rootTenantId).toBe(root.id);
  });

  it("clears both references and is idempotent when already aligned", async () => {
    const root = getMockTenant();
    const aoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
      parentTenantId: root.id,
      rootTenantId: root.id,
    };
    await addOneTenant(root);
    await addOneTenant(aoo);

    const aligned = await callUpdate(aoo, root.id, root.id);
    expect(aligned.metadata.version).toBe(0);
    expect((await readLastTenantEvent(aoo.id))?.type).toBe("TenantOnboarded");

    const cleared = await callUpdate(aoo, null, null);
    expect(cleared.data.parentTenantId).toBeUndefined();
    expect(cleared.data.rootTenantId).toBeUndefined();
    expect((await readLastTenantEvent(aoo.id))?.type).toBe(
      "TenantParentUpdated"
    );
  });

  it("returns 404 when the referenced parent does not exist", async () => {
    const root = getMockTenant();
    const aoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
    };
    const missingParentId = generateId<TenantId>();
    await addOneTenant(root);
    await addOneTenant(aoo);

    await expect(
      callUpdate(aoo, missingParentId, root.id)
    ).rejects.toThrowError(tenantNotFound(missingParentId));
  });

  it("returns 404 when the referenced root does not exist", async () => {
    const root = getMockTenant();
    const aoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
    };
    await addOneTenant(root);
    await addOneTenant(aoo);

    const missingRootId = generateId<TenantId>();
    await expect(callUpdate(aoo, root.id, missingRootId)).rejects.toThrowError(
      tenantNotFound(missingRootId)
    );
  });

  it("rejects a root reference that identifies a sub-unit", async () => {
    const root = getMockTenant();
    const aoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
    };
    const otherAoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
    };
    await addOneTenant(root);
    await addOneTenant(aoo);
    await addOneTenant(otherAoo);

    await expect(callUpdate(aoo, root.id, otherAoo.id)).rejects.toMatchObject({
      code: tenantRootMustBeMainInstitution(aoo.id).code,
    });
  });

  it.each([
    {
      name: "target is not a sub-unit",
      target: getMockTenant(),
      parent: getMockTenant(),
      root: getMockTenant(),
      parentRef: "parent" as const,
      expectedError: tenantIsNotAooOrUo,
    },
    {
      name: "AOO parent is not the root institution",
      target: { ...getMockTenant(), subUnitType: tenantUnitType.AOO },
      parent: { ...getMockTenant(), subUnitType: tenantUnitType.AOO },
      root: getMockTenant(),
      parentRef: "parent" as const,
      expectedError: aooTenantParentMustBeRootTenant,
    },
    {
      name: "UO parent is another UO",
      target: { ...getMockTenant(), subUnitType: tenantUnitType.UO },
      parent: { ...getMockTenant(), subUnitType: tenantUnitType.UO },
      root: getMockTenant(),
      parentRef: "parent" as const,
      expectedError: uoTenantParentMustBeRootTenantOrAooTenant,
    },
    {
      name: "UO parent is root but parent and root references differ",
      target: { ...getMockTenant(), subUnitType: tenantUnitType.UO },
      parent: getMockTenant(),
      root: getMockTenant(),
      parentRef: "parent" as const,
      expectedError: uoTenantParentMustBeRootTenantOrAooTenant,
    },
  ])(
    "rejects invalid relation: $name",
    async ({ target, parent, root, parentRef, expectedError }) => {
      await addOneTenant(target);
      await addOneTenant(parent);
      await addOneTenant(root);

      await expect(
        callUpdate(target, parentRef === "parent" ? parent.id : null, root.id)
      ).rejects.toThrowError(expectedError(target.id));
    }
  );

  it("rejects partial null references and self-parenting", async () => {
    const aoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
    };
    await addOneTenant(aoo);

    await expect(callUpdate(aoo, null, generateId())).rejects.toMatchObject({
      code: tenantParentRootReferencesMustBeBothSetOrNull(aoo.id).code,
    });
    await expect(callUpdate(aoo, aoo.id, aoo.id)).rejects.toMatchObject({
      code: tenantCannotBeItsOwnParent(aoo.id).code,
    });
  });

  it.each([undefined, generateId<TenantId>()])(
    "sets a UO parent AOO even when its root reference is not aligned (%s)",
    async (parentRootTenantId) => {
      const root = getMockTenant();
      const aoo: Tenant = {
        ...getMockTenant(),
        subUnitType: tenantUnitType.AOO,
        parentTenantId: parentRootTenantId,
        rootTenantId: parentRootTenantId,
      };
      const uo: Tenant = {
        ...getMockTenant(),
        subUnitType: tenantUnitType.UO,
      };
      await addOneTenant(root);
      await addOneTenant(aoo);
      await addOneTenant(uo);

      const result = await callUpdate(uo, aoo.id, root.id);

      expect(result.data).toMatchObject({
        parentTenantId: aoo.id,
        rootTenantId: root.id,
      });
      const event = await readLastTenantEvent(uo.id);
      expect(event).toMatchObject({
        type: "TenantParentUpdated",
        version: "1",
      });
      expect(
        protobufDecoder(TenantParentUpdatedV2).parse(event.data).tenant
      ).toEqual(toTenantV2(result.data));
    }
  );

  it("sets a main institution as both parent and root for a UO", async () => {
    const root = getMockTenant();
    const uo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.UO,
    };
    await addOneTenant(root);
    await addOneTenant(uo);

    const result = await callUpdate(uo, root.id, root.id);

    expect(result.data).toMatchObject({
      parentTenantId: root.id,
      rootTenantId: root.id,
    });
    expect(result.metadata.version).toBe(1);
  });

  it("replaces existing parent and root references in the emitted tenant", async () => {
    const oldRoot = getMockTenant();
    const newRoot = getMockTenant();
    const aoo: Tenant = {
      ...getMockTenant(),
      subUnitType: tenantUnitType.AOO,
      parentTenantId: oldRoot.id,
      rootTenantId: oldRoot.id,
    };
    await addOneTenant(oldRoot);
    await addOneTenant(newRoot);
    await addOneTenant(aoo);

    const result = await callUpdate(aoo, newRoot.id, newRoot.id);

    expect(result.data).toMatchObject({
      parentTenantId: newRoot.id,
      rootTenantId: newRoot.id,
    });
    const event = await readLastTenantEvent(aoo.id);
    expect(event).toMatchObject({
      type: "TenantParentUpdated",
      version: "1",
    });
    expect(
      protobufDecoder(TenantParentUpdatedV2).parse(event.data).tenant
    ).toEqual(toTenantV2(result.data));
  });

  it.each([tenantUnitType.AOO, tenantUnitType.UO])(
    "does not emit an event when %s references are already absent",
    async (subUnitType) => {
      const tenant: Tenant = { ...getMockTenant(), subUnitType };
      await addOneTenant(tenant);

      const result = await callUpdate(tenant, null, null);

      expect(result.data).toEqual(tenant);
      expect(result.metadata.version).toBe(0);
      expect(await readLastTenantEvent(tenant.id)).toMatchObject({
        type: "TenantOnboarded",
        version: "0",
      });
    }
  );
});
