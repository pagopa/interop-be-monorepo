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
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/clone authorization test", () => {
  const mockDocument = getMockDocument();

  const document1 = {
    ...mockDocument,
    name: `${mockDocument.name}_1`,
    path: `Path/${mockDocument.id}/${mockDocument.name}_1`,
  };
  const document2 = {
    ...mockDocument,
    name: `${mockDocument.name}_2`,
    path: `Path/${mockDocument.id}/${mockDocument.name}_2`,
  };
  const interfaceDocument = {
    ...mockDocument,
    name: `${mockDocument.name}_interface`,
    path: `Path/${mockDocument.id}/${mockDocument.name}_interface`,
  };

  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.draft,
    interface: interfaceDocument,
    docs: [document1, document2],
  };
  const eservice: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const mockApiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(eservice)
  );

  vi.spyOn(catalogService, "cloneDescriptor").mockResolvedValue(eservice);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/${descriptorId}/clone`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(eservice);

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({
        ...getMockAuthData(),
        userRoles: [role],
      });
      const res = await makeRequest(token, eservice.id, descriptor.id);

      expect(res.body).toEqual(mockApiEservice);
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, eservice.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "", "");
    expect(res.status).toBe(404);
  });
});
