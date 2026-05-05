/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getMockTenant,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  attributeKind,
  generateId,
  SCP,
  TenantId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { importAttributes } from "../src/service/processor.js";
import {
  REGISTRY_ATTRIBUTES_SEEDS,
  generateCodeFromName,
} from "../src/service/attributeService.js";
import {
  cleanup,
  readModelService,
  addOneAttribute,
  addOneTenant,
} from "./helpers.js";

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual("pagopa-interop-commons");
  return {
    ...actual,
    waitForReadModelMetadataVersion: vi.fn().mockResolvedValue(undefined),
  };
});
let attrAdesione: Attribute;
let attrSCP: Attribute;

beforeAll(() => {
  attrAdesione = {
    ...getMockAttribute(attributeKind.certified),
    id: generateId(),
    origin: REGISTRY_ATTRIBUTES_SEEDS.adesione.origin,
    code: generateCodeFromName(REGISTRY_ATTRIBUTES_SEEDS.adesione.name),
    name: REGISTRY_ATTRIBUTES_SEEDS.adesione.name,
  };

  attrSCP = {
    ...getMockAttribute(attributeKind.certified),
    id: generateId(),
    origin: REGISTRY_ATTRIBUTES_SEEDS.scp.origin,
    code: generateCodeFromName(REGISTRY_ATTRIBUTES_SEEDS.scp.name),
    name: REGISTRY_ATTRIBUTES_SEEDS.scp.name,
  };
});

afterEach(async () => {
  await cleanup();
});

describe("private-certified-attributes-importer integration tests", () => {
  it("should correctly retrieve only tenants with PDND_INFOCAMERE origin from database", async () => {
    const targetId = generateId<TenantId>();
    await addOneTenant({
      ...getMockTenant(targetId),
      externalId: { origin: "PDND_INFOCAMERE_123", value: "VALUE-1" },
    });

    await addOneTenant({
      ...getMockTenant(),
      externalId: { origin: "IPA", value: "VALUE-2" },
    });

    const results =
      await readModelService.getTenantsByOriginPrefix("PDND_INFOCAMERE");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(targetId);
  });

  it("should correctly identify tenants that already have specific attributes in DB", async () => {
    await addOneAttribute(attrAdesione);

    const tenantId = generateId<TenantId>();
    await addOneTenant({
      ...getMockTenant(tenantId),
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(attrAdesione.id),
          revocationTimestamp: undefined,
        },
      ],
    });

    const results = await readModelService.getTenantsWithAttributes([
      attrAdesione.id,
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(tenantId);
  });

  it("should run the full importer logic and identify required API calls based on DB state", async () => {
    await addOneAttribute(attrAdesione);
    await addOneAttribute(attrSCP);

    const tenantId = generateId<TenantId>();
    await addOneTenant({
      ...getMockTenant(tenantId),
      externalId: { origin: "PDND_INFOCAMERE", value: "T-IT-01" },
      selfcareInstitutionType: SCP,
      attributes: [],
    });

    const tenantProcessMock = {
      internalAssignCertifiedAttribute: vi.fn().mockResolvedValue(undefined),
      internalRevokeCertifiedAttribute: vi.fn(),
    };

    await importAttributes(
      readModelService,
      {
        attributeRegistryClient: {
          createInternalCertifiedAttribute: vi.fn(),
        } as any,
        tenantProcessClient: tenantProcessMock as any,
      },
      { get: vi.fn().mockResolvedValue({ serialized: "token" }) } as any,
      genericLogger,
      {
        Authorization: "Bearer token",
        "X-Correlation-Id": generateId(),
      } as any,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedAttribute
    ).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        params: expect.objectContaining({
          tExternalId: "T-IT-01",
          aExternalId: attrAdesione.code,
        }),
      })
    );
    expect(
      tenantProcessMock.internalAssignCertifiedAttribute
    ).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        params: expect.objectContaining({
          tExternalId: "T-IT-01",
          aExternalId: attrSCP.code,
        }),
      })
    );
  });
});
