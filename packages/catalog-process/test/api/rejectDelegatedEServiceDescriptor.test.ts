/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";

describe("API /eservices/:eServiceId/descriptors/:descriptorId/reject authorization test", () => {
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();

  const descriptor: Descriptor = {
    ...mockDescriptor,
    interface: mockDocument,
    state: descriptorState.waitingForApproval,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
    riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
  };

  const rejectionPayload = {
    rejectionReason: "reason",
  };

  vi.spyOn(
    catalogService,
    "rejectDelegatedEServiceDescriptor"
  ).mockResolvedValue();

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/${descriptorId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(rejectionPayload);

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, mockEService.id, descriptor.id);

      expect(res.status).toBe(204);
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
    const res = await makeRequest(
      generateToken(getMockAuthData()),
      "" as EServiceId,
      "" as DescriptorId
    );
    expect(res.status).toBe(404);
  });
});
