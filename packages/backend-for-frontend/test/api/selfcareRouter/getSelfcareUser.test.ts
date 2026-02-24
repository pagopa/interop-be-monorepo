import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, UserId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi, selfcareV2ClientApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toApiSelfcareUser } from "../../../src/api/selfcareApiConverter.js";
import {
  selfcareEntityNotFilled,
  userNotFound,
} from "../../../src/model/errors.js";

describe("API GET /users/:userId", () => {
  const mockUserResource: selfcareV2ClientApi.UserResource = {
    id: generateId(),
    name: "Test",
    surname: "User",
    roles: ["ADMIN_EA", "MANAGER"],
    email: "genericMail@test.it",
    fiscalCode: "ABCDEF12G34H567I",
    role: "ADMIN_EA",
  };
  const mockResponse: bffApi.User = toApiSelfcareUser(
    mockUserResource,
    generateId()
  );

  beforeEach(() => {
    services.selfcareService.getSelfcareUser = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (userId: string, token: string) =>
    request(api)
      .get(`${appBasePath}/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 with user data for ADMIN_ROLE", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);

    const res = await makeRequest(mockUserResource.id, token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse);
  });

  it("Should return 404 if user is not found", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);

    services.selfcareService.getSelfcareUser = vi
      .fn()
      .mockRejectedValue(userNotFound(mockUserResource.id, generateId()));

    const res = await makeRequest(mockUserResource.id, token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid userId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest("invalid" as UserId, token);
    expect(res.status).toBe(400);
  });

  it("should return 500 if an error occurs in the service", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    services.selfcareService.getSelfcareUser = vi
      .fn()
      .mockRejectedValue(
        selfcareEntityNotFilled("UserInstitutionResource", "unknown")
      );
    const res = await makeRequest(mockUserResource.id, token);
    expect(res.status).toBe(500);
  });
});
