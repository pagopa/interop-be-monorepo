/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { EService, generateId } from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { catalogApi } from "pagopa-interop-api-clients";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { eServiceNameDuplicate } from "../../src/model/domain/errors.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { EServiceSeed } from "../../../api-clients/dist/catalogApi.js";

describe("API /eservices authorization test", () => {
  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [getMockDescriptor()],
  };

  const apiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const eserviceSeed: EServiceSeed = {
    name: apiEservice.name,
    description: apiEservice.description,
    technology: "REST",
    mode: "RECEIVE",
    descriptor: {
      audience: apiEservice.descriptors[0].audience,
      voucherLifespan: apiEservice.descriptors[0].voucherLifespan,
      dailyCallsPerConsumer: apiEservice.descriptors[0].dailyCallsPerConsumer,
      dailyCallsTotal: apiEservice.descriptors[0].dailyCallsTotal,
      agreementApprovalPolicy:
        apiEservice.descriptors[0].agreementApprovalPolicy,
    },
  };

  vi.spyOn(catalogService, "createEService").mockResolvedValue(mockEService);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string) =>
    request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(eserviceSeed);

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token);

    expect(res.status).toBe(403);
  });

  it("Should return 409 for name conflict", async () => {
    vi.spyOn(catalogService, "createEService").mockRejectedValue(
      eServiceNameDuplicate(eserviceSeed.name)
    );

    const res = await makeRequest(generateToken(getMockAuthData()));

    expect(res.status).toBe(409);
  });
});
