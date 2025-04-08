/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
} from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import {
  buildInterfaceSeed,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/documents authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    docs: [getMockDocument()],
    state: descriptorState.archived,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  vi.spyOn(catalogService, "uploadDocument").mockResolvedValue(mockEService);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/${descriptorId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(buildInterfaceSeed());

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
