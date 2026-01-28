import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  m2mGatewayApiV3,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import { api, mockUserService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { userNotFound } from "../../../src/model/errors.js";

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
  const mockResponse: m2mGatewayApiV3.User = {
    userId: mockUserResource.id,
    name: mockUserResource.name,
    familyName: mockUserResource.surname,
    roles: mockUserResource.roles ?? [],
  };

  beforeEach(() => {
    mockUserService.getUserById = vi.fn().mockResolvedValue(mockResponse);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (userId: string, token: string) =>
    request(api)
      .get(`${appBasePath}/users/${userId}`)
      .set("Authorization", `Bearer ${token}`);

  it("Should return 200 with user data for M2M_ADMIN_ROLE", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);

    const res = await makeRequest(mockUserResource.id, token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse);
  });

  it("Should return 400 if passed an invalid userId", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest("invalid", token);
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.M2M_ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(generateId(), token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 if user is not found", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);

    mockUserService.getUserById = vi
      .fn()
      .mockRejectedValue(
        userNotFound(mockUserResource.id as UserId, generateId())
      );

    const res = await makeRequest(mockUserResource.id, token);
    expect(res.status).toBe(404);
  });

  it.each([
    { ...mockResponse, id: "I am a teapot" },
    {},
    { ...mockResponse, firstName: 7 },
    { ...mockResponse, lastName: 9 },
    { ...mockResponse, firstName: null },
    { ...mockResponse, lastName: null },
    { ...mockResponse, firstName: undefined },
    { ...mockResponse, lastName: undefined },
    { ...mockResponse, additionalProp: "invalid" },
  ])(
    "should return 500 if an error occurs in the service with payload %s",
    async (mockedWrongResponse) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      mockUserService.getUserById = vi
        .fn()
        .mockResolvedValue(mockedWrongResponse);
      const res = await makeRequest(mockUserResource.id, token);
      expect(res.status).toBe(500);
    }
  );
});
