/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { AuthData } from "pagopa-interop-commons";
import { EService, generateId, tenantKind } from "pagopa-interop-models";
import { getMockValidRiskAnalysis } from "pagopa-interop-commons-test/index.js";
import { catalogApi } from "pagopa-interop-api-clients";
// import { catalogService } from "../../src/routers/EServiceRouter.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { EServiceSeed } from "../../../api-clients/dist/catalogApi.js";

import { createPayload } from "../mockedPayloadForToken.js";
import { api } from "../vitest.api.setup.js";
import { eServiceNameDuplicate } from "../../src/model/domain/errors.js";
import {
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
describe("API /eservices authorization test", async () => {
  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [getMockDescriptor()],
    riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
  };

  const mockApiEservice: catalogApi.EService =
    eServiceToApiEService(mockEService);

  const mockEserviceSeed: EServiceSeed = {
    name: mockApiEservice.name,
    description: mockApiEservice.description,
    technology: "REST",
    mode: "RECEIVE",
    descriptor: {
      audience: mockApiEservice.descriptors[0].audience,
      voucherLifespan: mockApiEservice.descriptors[0].voucherLifespan,
      dailyCallsPerConsumer:
        mockApiEservice.descriptors[0].dailyCallsPerConsumer,
      dailyCallsTotal: mockApiEservice.descriptors[0].dailyCallsTotal,
      agreementApprovalPolicy:
        mockApiEservice.descriptors[0].agreementApprovalPolicy,
    },
  };

  vi.spyOn(catalogService, "createEService").mockImplementation(() =>
    Promise.resolve(mockEService)
  );

  const authData: AuthData = {
    ...getMockAuthData(),
    userRoles: ["admin", "api"],
  };

  const validToken = jwt.sign(createPayload(authData), "test-secret");

  it("Should return 200 for a user with ADMIN_ROLE, API_ROLE role", async () => {
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send(mockEserviceSeed);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiEservice);
  });

  it("Should return 403 for a user with role other than ADMIN_ROLE, API_ROLE", async () => {
    const invalidAuthData: AuthData = {
      ...getMockAuthData(),
      userRoles: ["internal"],
    };

    const invalidToken = jwt.sign(
      createPayload(invalidAuthData),
      "test-secret"
    );

    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${invalidToken}`)
      .set("X-Correlation-Id", generateId())
      .send(mockEserviceSeed);

    expect(res.status).toBe(403);
  });

  it("Should return 400 for invalid Input", async () => {
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("Incorrect value for body");
  });

  it("Should return 400 for missing required properties name", async () => {
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send({
        description: mockApiEservice.description,
        technology: "REST",
        mode: "RECEIVE",
        descriptor: {
          audience: mockApiEservice.descriptors[0].audience,
          voucherLifespan: mockApiEservice.descriptors[0].voucherLifespan,
          dailyCallsPerConsumer:
            mockApiEservice.descriptors[0].dailyCallsPerConsumer,
          dailyCallsTotal: mockApiEservice.descriptors[0].dailyCallsTotal,
          agreementApprovalPolicy:
            mockApiEservice.descriptors[0].agreementApprovalPolicy,
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("Incorrect value for body");
    expect(res.text).toContain('Required at \\"name\\""');
  });

  it("Should return 400 for min lenght required at properties name", async () => {
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send({ ...mockEserviceSeed, name: "test" });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("Incorrect value for body");
    expect(res.text).toContain(
      'String must contain at least 5 character(s) at \\"name\\""'
    );
  });

  it("Should return 400 for max lenght exceed at properties name", async () => {
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send({
        ...mockEserviceSeed,
        name: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("Incorrect value for body");
    expect(res.text).toContain(
      'String must contain at most 60 character(s) at \\"name\\""'
    );
  });

  it("Should return 409 for name conflict", async () => {
    vi.spyOn(catalogService, "createEService").mockImplementation(() =>
      Promise.reject(eServiceNameDuplicate(mockEserviceSeed.name))
    );

    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send(mockEserviceSeed);

    expect(res.status).toBe(409);
  });
});
