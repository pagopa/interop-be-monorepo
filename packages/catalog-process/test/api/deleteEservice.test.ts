/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { generateToken, getMockEService } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceNotFound,
  eserviceNotInDraftState,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId} authorization test", () => {
  const eservice: EService = getMockEService();

  catalogService.deleteEService = vi.fn().mockResolvedValue({});

  const makeRequest = async (token: string, eServiceId: EServiceId) =>
    request(api)
      .delete(`/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eserviceNotInDraftState(eservice.id),
      expectedStatus: 409,
    },
    {
      error: eServiceNotFound(eservice.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.deleteEService = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eservice.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { eServiceId: "invalidId" }])(
    "Should return 400 if passed invalid params: %s",
    async ({ eServiceId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId as EServiceId);

      expect(res.status).toBe(400);
    }
  );
});
