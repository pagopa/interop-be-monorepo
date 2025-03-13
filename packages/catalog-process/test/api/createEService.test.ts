/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { AuthData } from "pagopa-interop-commons";
import { EService, generateId, tenantKind } from "pagopa-interop-models";
import { getMockValidRiskAnalysis } from "pagopa-interop-commons-test/index.js";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
} from "../mockUtils.js";
import { createPayload } from "../mockedPayloadForToken.js";
import { api } from "../vitest.api.setup.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { EServiceSeed } from "../../../api-clients/dist/catalogApi.js";
import { eServiceDuplicate } from "../../src/model/domain/errors.js";

describe("Test autorizzazione API /eservices", async () => {
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

  it("Dovrebbe restituire 200 per un utente con ruolo ADMIN_ROLE, API_ROLE", async () => {
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send(mockEserviceSeed);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiEservice);
  });

  it("Dovrebbe restituire 403 per un utente con diverso da ADMIN_ROLE, API_ROLE", async () => {
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

  it("Dovrebbe restituire 400 per invalid Input", async () => {
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("Incorrect value for body");
  });

  it("Dovrebbe restituire 409 per name conflict", async () => {
    vi.spyOn(catalogService, "createEService").mockImplementation((input) => {
      if (input.name === mockEserviceSeed.name) {
        return Promise.reject(eServiceDuplicate(input.name));
      }
      return Promise.resolve(mockEService);
    });

    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", generateId())
      .send(mockEserviceSeed);

    expect(res.status).toBe(409);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});
