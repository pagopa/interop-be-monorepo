/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { tenantApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, Tenant, TenantId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import { tenantNotFound } from "../../src/model/domain/errors.js";
import { TenantWithHierarchy } from "../../src/model/domain/models.js";
import { api, tenantService } from "../vitest.api.setup.js";

describe("API GET /tenants/{id} test", () => {
  const remoteIdAssignmentTimestamp = new Date();
  const tenant: Tenant = {
    ...getMockTenant(),
    remoteIds: [
      {
        origin: "IPA",
        value: "remote-id",
        assignmentTimestamp: remoteIdAssignmentTimestamp,
      },
    ],
  };

  const serviceResponse = getMockWithMetadata(tenant);
  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.getTenantById = vi.fn().mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.INTERNAL_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.VIEWER_ROLE,
    authRole.REVIEWER_ROLE,
  ];

  const makeRequest = async (token: string, tenantId: TenantId = tenant.id) =>
    request(api)
      .get(`/tenants/${tenantId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.body.remoteIds).toEqual([
        {
          origin: "IPA",
          value: "remote-id",
          assignmentTimestamp: remoteIdAssignmentTimestamp.toJSON(),
        },
      ]);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for tenantNotFound", async () => {
    tenantService.getTenantById = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as TenantId);
    expect(res.status).toBe(400);
  });

  it("Should include selfcareInstitutionType in the response when the tenant has it", async () => {
    const tenantWithInstitutionType: Tenant = {
      ...getMockTenant(),
      selfcareInstitutionType: "SCP",
    };
    tenantService.getTenantById = vi
      .fn()
      .mockResolvedValue(getMockWithMetadata(tenantWithInstitutionType));

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, tenantWithInstitutionType.id);
    expect(res.status).toBe(200);
    expect(res.body.selfcareInstitutionType).toBe("SCP");
  });

  it.each([
    { name: "root", subUnitType: undefined, parentTenant: undefined },
    {
      name: "AOO",
      subUnitType: "AOO" as const,
      parentTenant: { id: generateId<TenantId>(), name: "Root" },
    },
    {
      name: "direct UO",
      subUnitType: "UO" as const,
      parentTenant: { id: generateId<TenantId>(), name: "Root" },
    },
    {
      name: "nested UO",
      subUnitType: "UO" as const,
      parentTenant: {
        id: generateId<TenantId>(),
        name: "Area",
        subUnitType: "AOO" as const,
        parentTenant: { id: generateId<TenantId>(), name: "Root" },
      },
    },
    {
      name: "unresolved UO",
      subUnitType: "UO" as const,
      parentTenant: undefined,
    },
    {
      name: "untyped unit",
      subUnitType: undefined,
      parentTenant: { id: generateId<TenantId>(), name: "Root" },
    },
  ])(
    "Should serialize hierarchy for $name",
    async ({ subUnitType, parentTenant }) => {
      const result: TenantWithHierarchy = {
        ...getMockTenant(),
        subUnitType,
        parentTenant,
      };
      tenantService.getTenantById = vi
        .fn()
        .mockResolvedValue(getMockWithMetadata(result));
      const res = await makeRequest(
        generateToken(authRole.ADMIN_ROLE),
        result.id
      );
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(result.name);
      expect(res.body.subUnitType).toBe(subUnitType);
      expect(res.body.parentTenant).toEqual(parentTenant);
      expect(res.body).not.toHaveProperty("parentTenantId");
      expect(res.body).not.toHaveProperty("rootTenantId");
      if (!parentTenant) {
        expect(res.body).not.toHaveProperty("parentTenant");
      }
    }
  );
});
