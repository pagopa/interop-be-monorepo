import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { selfcareEntityNotFilled } from "../../../src/model/errors.js";

describe("API GET /selfcare/institutions/products", () => {
  const mockProducts: bffApi.SelfcareProduct[] = [
    { id: "prod-1", name: "Product One" },
    { id: "prod-2", name: "Product Two" },
  ];

  beforeEach(() => {
    services.selfcareService.getSelfcareInstitutionsProducts = vi
      .fn()
      .mockResolvedValue(mockProducts);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/selfcare/institutions/products`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 with list of products", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);

    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockProducts);
  });

  it("should return 500 if an error occurs in the service", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    services.selfcareService.getSelfcareInstitutionsProducts = vi
      .fn()
      .mockRejectedValue(
        selfcareEntityNotFilled("UserInstitutionResource", "unknown")
      );
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });
});
