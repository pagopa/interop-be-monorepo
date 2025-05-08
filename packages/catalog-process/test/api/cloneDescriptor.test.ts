/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  eServiceNameDuplicate,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

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

  catalogService.cloneDescriptor = vi.fn().mockResolvedValue(eservice);

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
  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id, descriptor.id);

      expect(res.body).toEqual(mockApiEservice);
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it("Should return 409 for eServiceNameDuplicate", async () => {
    catalogService.cloneDescriptor = vi
      .fn()
      .mockRejectedValue(eServiceNameDuplicate(eservice.name));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eservice.id, descriptor.id);
    expect(res.status).toBe(409);
  });

  it("Should return 404 for eserviceNotFound", async () => {
    catalogService.cloneDescriptor = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(eservice.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eservice.id, descriptor.id);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eServiceDescriptorNotFound", async () => {
    catalogService.cloneDescriptor = vi
      .fn()
      .mockRejectedValue(
        eServiceDescriptorNotFound(eservice.id, descriptor.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eservice.id, descriptor.id);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for templateInstanceNotAllowed", async () => {
    catalogService.cloneDescriptor = vi
      .fn()
      .mockRejectedValue(
        templateInstanceNotAllowed(eservice.id, eservice.templateId!)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eservice.id, descriptor.id);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for operationForbidden", async () => {
    catalogService.cloneDescriptor = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eservice.id, descriptor.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
