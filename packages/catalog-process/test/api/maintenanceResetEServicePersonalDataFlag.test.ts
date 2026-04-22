import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import { EServiceId, generateId } from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import {
  eserviceInDraftState,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";

describe("DELETE /maintenance/eservices/:eServiceId/personalDataFlag", () => {
  const defaultEServiceId = generateId<EServiceId>();
  const defaultBody = {
    reason: "Reset personalData flag for maintenance",
  };

  beforeEach(() => {
    catalogService.maintenanceResetEServicePersonalDataFlag = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = defaultEServiceId,
    body: Record<string, unknown> = defaultBody
  ) =>
    request(api)
      .delete(`/maintenance/eservices/${eServiceId}/personalDataFlag`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Maintenance", async () => {
    const token = generateToken(authRole.MAINTENANCE_ROLE);

    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.MAINTENANCE_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("should return 400 if eservice is in draft state", async () => {
    catalogService.maintenanceResetEServicePersonalDataFlag = vi
      .fn()
      .mockRejectedValue(eserviceInDraftState(defaultEServiceId));
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("should return 404 for eserviceNotFound", async () => {
    catalogService.maintenanceResetEServicePersonalDataFlag = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(defaultEServiceId));
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { body: {} },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceId, body }) => {
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        body as Record<string, unknown>
      );
      expect(res.status).toBe(400);
    }
  );
});
