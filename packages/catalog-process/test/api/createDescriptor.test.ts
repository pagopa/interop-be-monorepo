/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Attribute,
  Descriptor,
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
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import { buildCreateDescriptorSeed } from "../mockUtils.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  attributeDuplicatedInGroup,
  attributeNotFound,
  draftDescriptorAlreadyExists,
  eServiceNotFound,
  inconsistentDailyCalls,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/descriptors authorization test", () => {
  const mockDescriptor = {
    ...getMockDescriptor(),
    docs: [],
  };

  const attribute: Attribute = {
    name: "Attribute name",
    id: generateId(),
    kind: "Declared",
    description: "Attribute Description",
    creationTime: new Date(),
  };

  const descriptorSeed: catalogApi.EServiceDescriptorSeed = {
    ...buildCreateDescriptorSeed(mockDescriptor),
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id }]],
      verified: [],
    },
  };

  const newDescriptor: Descriptor = {
    ...mockDescriptor,
    version: "1",
    createdAt: new Date(),
    id: mockDescriptor.id,
    serverUrls: [],
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id }]],
      verified: [],
    },
  };

  const eservice: EService = {
    ...getMockEService(),
    descriptors: [newDescriptor],
  };

  const serviceResponse = getMockWithMetadata({
    eservice,
    createdDescriptorId: newDescriptor.id,
  });

  const apiCreatedDescriptor = catalogApi.CreatedEServiceDescriptor.parse({
    eservice: eServiceToApiEService(eservice),
    createdDescriptorId: newDescriptor.id,
  });

  catalogService.createDescriptor = vi.fn().mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServiceDescriptorSeed = descriptorSeed
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id);
      expect(res.body).toEqual(apiCreatedDescriptor);
      expect(res.status).toBe(200);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceNotFound(eservice.id),
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
    {
      error: draftDescriptorAlreadyExists(eservice.id),
      expectedStatus: 400,
    },
    {
      error: attributeNotFound(generateId()),
      expectedStatus: 400,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
    {
      error: attributeDuplicatedInGroup(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.createDescriptor = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eservice.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, eservice.id],
    [{ ...descriptorSeed, voucherLifespan: "invalid" }, eservice.id],
    [{ ...descriptorSeed, audience: 123 }, eservice.id],
    [{ ...descriptorSeed, agreementApprovalPolicy: null }, eservice.id],
    [{ ...descriptorSeed, dailyCallsTotal: -1 }, eservice.id],
    [{ ...descriptorSeed, attributes: undefined }, eservice.id],
    [{ ...descriptorSeed, docs: [{}] }, eservice.id],
    [{}, "invalidId"],
  ])(
    "Should return 400 if passed invalid descriptor params: %s (eserviceId: %s)",
    async (body, eserviceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eserviceId as EServiceId,
        body as catalogApi.EServiceDescriptorSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
