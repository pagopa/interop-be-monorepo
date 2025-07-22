/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { systemRole, userRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../vitest.api.setup.js";
import { appBasePath } from "../../src/config/appBasePath.js";
import { getMockBffApiPurpose } from "../mockUtils.js";

describe("uiAuthDataValidationMiddleware", () => {
  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/purposes/${generateId()}`)
      .set("Authorization", `Bearer ${token}`)
      .send();
  // ^ using GET /purposes/:purposeId as a dummy endpoint to test the middleware

  services.purposeService.getPurpose = vi
    .fn()
    .mockResolvedValue(getMockBffApiPurpose());

  it.each(Object.values(userRole))(
    "Should correctly accept tokens with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
    }
  );

  it.each(Object.values(systemRole))(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(403);
    }
  );
});
