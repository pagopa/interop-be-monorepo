/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { EService, generateId } from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceNameDuplicateForProducer,
  eserviceTemplateNameConflict,
  originNotCompliant,
} from "../../src/model/domain/errors.js";

describe("API /eservices authorization test", () => {
  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [getMockDescriptor()],
  };

  const serviceResponse = getMockWithMetadata(mockEService);

  const apiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const eserviceSeed: catalogApi.EServiceSeed = {
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

  catalogService.createEService = vi.fn().mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    body: catalogApi.EServiceSeed = eserviceSeed
  ) =>
    request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 201 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(apiEservice);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceNameDuplicateForProducer(
        mockEService.name,
        mockEService.producerId
      ),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplateNameConflict(mockEService.id),
      expectedStatus: 409,
    },
    {
      error: originNotCompliant("Not compliant origin"),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.createEService = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { ...eserviceSeed, invalidParam: "invalidValue" },
    { ...eserviceSeed, name: 1 },
    { ...eserviceSeed, description: 2 },
    { ...eserviceSeed, technology: "INVALID_TECH" },
    { ...eserviceSeed, mode: "INVALID_MODE" },
    { ...eserviceSeed, name: undefined },
    { ...eserviceSeed, descriptor: undefined },
    {
      ...eserviceSeed,
      descriptor: {
        ...eserviceSeed.descriptor,
        audience: undefined,
      },
    },
    {
      ...eserviceSeed,
      descriptor: {
        ...eserviceSeed.descriptor,
        voucherLifespan: "not-a-number",
      },
    },
    {
      ...eserviceSeed,
      descriptor: {
        ...eserviceSeed.descriptor,
        dailyCallsPerConsumer: "not-a-number",
      },
    },
    {
      ...eserviceSeed,
      descriptor: {
        ...eserviceSeed.descriptor,
        dailyCallsTotal: "not-a-number",
      },
    },
    {
      ...eserviceSeed,
      descriptor: {
        ...eserviceSeed.descriptor,
        agreementApprovalPolicy: "INVALID_POLICY",
      },
    },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as catalogApi.EServiceSeed);

    expect(res.status).toBe(400);
  });
});
