/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { EService, generateId } from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceNameDuplicate,
  originNotCompliant,
} from "../../src/model/domain/errors.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
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

  catalogService.createEService = vi.fn().mockResolvedValue(mockEService);

  const makeRequest = async (token: string) =>
    request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(eserviceSeed);
  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);

    expect(res.status).toBe(403);
  });

  it("Should return 409 for eServiceNameDuplicate", async () => {
    catalogService.createEService = vi
      .fn()
      .mockRejectedValue(eServiceNameDuplicate(mockEService.name));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 403 for originNotCompliant", async () => {
    catalogService.createEService = vi
      .fn()
      .mockRejectedValue(originNotCompliant("IPA"));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidMakeRequest = async (token: string) =>
      request(api)
        .post("/eservices")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Correlation-Id", generateId())
        .send({});
    const res = await invalidMakeRequest(token);
    expect(res.status).toBe(400);
  });
});
