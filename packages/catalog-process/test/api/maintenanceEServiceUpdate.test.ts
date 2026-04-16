import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import { EServiceId, generateId } from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  eserviceInDraftState,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";

describe("PATCH /maintenance/eservices/:eServiceId", () => {
  const defaultEServiceId = generateId<EServiceId>();
  const defaultBody: catalogApi.MaintenanceEServiceUpdatePayload = {
    currentVersion: 0,
    eservice: { personalData: false },
  };

  beforeEach(() => {
    catalogService.maintenanceUpdateEService = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = defaultEServiceId,
    body: catalogApi.MaintenanceEServiceUpdatePayload = defaultBody
  ) =>
    request(api)
      .patch(`/maintenance/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Maintenance", async () => {
    const token = generateToken(authRole.MAINTENANCE_ROLE);

    const res = await makeRequest(token);
    console.log(res);
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
    catalogService.maintenanceUpdateEService = vi
      .fn()
      .mockRejectedValue(eserviceInDraftState(defaultEServiceId));
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("should return 404 for eserviceNotFound", async () => {
    catalogService.maintenanceUpdateEService = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(defaultEServiceId));
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { body: {} },
    { body: { ...defaultBody, currentVersion: "invalid" } },
    {
      body: {
        ...defaultBody,
        eservice: { ...defaultBody.eservice, kind: "invalid" },
      },
    },
    { body: { ...defaultBody, extraField: 1 } },
    {
      body: {
        ...defaultBody,
        eservice: { ...defaultBody.eservice, extraField: "1" },
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceId, body }) => {
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        body as catalogApi.MaintenanceEServiceUpdatePayload
      );
      expect(res.status).toBe(400);
    }
  );
});
