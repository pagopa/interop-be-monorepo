/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockEServiceTemplate,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("API /templates/eservices/{eServiceId}/descriptors/{descriptorId} authorization test", () => {
  const mockDescriptor = getMockDescriptor();

  const descriptor: Descriptor = {
    ...mockDescriptor,
    state: descriptorState.draft,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
    riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
    templateRef: {
      id: getMockEServiceTemplate().id,
      instanceLabel: "test",
    },
  };

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const descriptorSeed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
    {
      audience: descriptor.audience,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: 200,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  vi.spyOn(
    catalogService,
    "updateDraftDescriptorTemplateInstance"
  ).mockResolvedValue(mockEService);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string
  ) =>
    request(api)
      .post(`/templates/eservices/${eServiceId}/descriptors/${descriptorId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(descriptorSeed);

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });

      const res = await makeRequest(token, mockEService.id, descriptor.id);

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
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "", "");
    expect(res.status).toBe(404);
  });
});
