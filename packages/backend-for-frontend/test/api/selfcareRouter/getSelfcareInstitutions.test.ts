import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { selfcareEntityNotFilled } from "../../../src/model/errors.js";

describe("API GET /selfcare/institutions", () => {
  const mockInstitutions: bffApi.SelfcareInstitution[] = [
    {
      id: generateId(),
      description: "Mock Institution A",
      userProductRoles: ["ADMIN"],
      parent: "Mock Parent A",
    },
    {
      id: generateId(),
      description: "Mock Institution B",
      userProductRoles: ["LIMITED"],
      parent: "Mock Parent B",
    },
  ];

  beforeEach(() => {
    services.selfcareService.getSelfcareInstitutions = vi
      .fn()
      .mockResolvedValue(mockInstitutions);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/selfcare/institutions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 with institutions list for ADMIN_ROLE", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);

    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockInstitutions);
  });

  it("should return 500 if an error occurs in the service", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    services.selfcareService.getSelfcareInstitutions = vi
      .fn()
      .mockRejectedValue(
        selfcareEntityNotFilled("UserInstitutionResource", "unknown")
      );
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });
});
