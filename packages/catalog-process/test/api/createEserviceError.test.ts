/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { AuthData } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { getMockAuthData } from "pagopa-interop-commons-test/index.js";
import { createPayload } from "../mockedPayloadForToken.js";
import { api } from "../vitest.api.setup.js";
import { eServiceNameDuplicate } from "../../src/model/domain/errors.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import {
  mockEService,
  mockApiEservice,
  mockEserviceSeed,
} from "./routesBody.js";
describe("API /eservices authorization test", async () => {
  vi.spyOn(catalogService, "createEService").mockImplementation(() =>
    Promise.resolve(mockEService)
  );

  const authData: AuthData = {
    ...getMockAuthData(),
    userRoles: ["admin", "api"],
  };

  const validToken = jwt.sign(createPayload(authData), "test-secret");

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
