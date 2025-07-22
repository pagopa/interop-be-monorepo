/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  eServiceNameDuplicateForProducer,
  templateInstanceNotAllowed,
  eserviceTemplateNameConflict,
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
    eServiceId: EServiceId,
    descriptorId: DescriptorId
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/${descriptorId}/clone`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

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

  it.each([
    {
      error: eServiceNameDuplicateForProducer(
        eservice.name,
        eservice.producerId
      ),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplateNameConflict(eservice.name),
      expectedStatus: 409,
    },
    {
      error: eServiceNotFound(eservice.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(eservice.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      error: templateInstanceNotAllowed(eservice.id, eservice.templateId!),
      expectedStatus: 403,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.cloneDescriptor = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eservice.id, descriptor.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { eServiceId: "invalidId", descriptorId: descriptor.id },
    { eServiceId: eservice.id, descriptorId: "invalidId" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ eServiceId, descriptorId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId
      );

      expect(res.status).toBe(400);
    }
  );
});
