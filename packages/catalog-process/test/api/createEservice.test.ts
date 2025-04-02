/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { AuthData, userRoles } from "pagopa-interop-commons";
import { EService, generateId, tenantKind } from "pagopa-interop-models";
import {
  getMockAuthData,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test/index.js";
import { catalogApi } from "pagopa-interop-api-clients";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { createPayload } from "../mockedPayloadForToken.js";
import { api } from "../vitest.api.setup.js";
import { eServiceNameDuplicate } from "../../src/model/domain/errors.js";
import {
  getMockDescriptor,
  getMockEService,
  getMockEserviceSeed,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";

describe("API /eservices authorization test", () => {
  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [getMockDescriptor()],
    riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
  };

  const mockApiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const mockEserviceSeed = getMockEserviceSeed(mockApiEservice);

  vi.spyOn(catalogService, "createEService").mockResolvedValue(mockEService);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, payload: object) =>
    request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, mockEserviceSeed);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockApiEservice);
    }
  );

  it.each([
    userRoles.INTERNAL_ROLE,
    userRoles.M2M_ROLE,
    userRoles.MAINTENANCE_ROLE,
    userRoles.SECURITY_ROLE,
    userRoles.SUPPORT_ROLE,
  ])("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, mockEserviceSeed);

    expect(res.status).toBe(403);
  });

  it("Should return 400 for invalid Input", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), {});

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("Incorrect value for body");
  });

  it("Should return 409 for name conflict", async () => {
    vi.spyOn(catalogService, "createEService").mockRejectedValue(
      eServiceNameDuplicate(mockEserviceSeed.name)
    );

    const res = await makeRequest(
      generateToken(getMockAuthData()),
      mockEserviceSeed
    );

    expect(res.status).toBe(409);
  });
});
