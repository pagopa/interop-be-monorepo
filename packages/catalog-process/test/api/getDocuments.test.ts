import { catalogApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { documentToApiDocument } from "../../src/model/domain/apiConverter.js";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";

describe("API GET /eservices/{eserviceId}/descriptors/{descriptorId}/documents test", () => {
  const mockDocument1 = getMockDocument();
  const mockDocument2 = getMockDocument();

  const mockDescriptor: Descriptor = {
    ...getMockDescriptor(),
    docs: [mockDocument1, mockDocument2],
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [mockDescriptor],
  };

  const mockProcessRespomse = {
    results: [mockDocument1, mockDocument2],
    totalCount: 2,
  };

  const apiResponse = catalogApi.EServiceDocs.parse({
    results: mockProcessRespomse.results.map(documentToApiDocument),
    totalCount: mockProcessRespomse.totalCount,
  });

  const mockQueryParams: catalogApi.GetEServiceDocumentsQueryParams = {
    offset: 0,
    limit: 10,
  };

  beforeEach(() => {
    catalogService.getDocuments = vi
      .fn()
      .mockResolvedValue(mockProcessRespomse);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (
    token: string,
    eserviceId: EServiceId = mockEService.id,
    descriptorId: DescriptorId = mockDescriptor.id,
    query: catalogApi.GetEServiceDocumentsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`/eservices/${eserviceId}/descriptors/${descriptorId}/documents`)
      .query(query)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(catalogService.getDocuments).toHaveBeenCalledWith(
        mockEService.id,
        mockDescriptor.id,
        mockQueryParams,
        expect.any(Object) // context
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
    { error: eServiceNotFound(generateId()), expectedStatus: 404 },
    {
      error: eServiceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.getDocuments = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "invalid" as EServiceId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed invalid descriptor id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      "invalid" as DescriptorId
    );
    expect(res.status).toBe(400);
  });

  it.each([
    {},
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      generateId<EServiceId>(),
      generateId<DescriptorId>(),
      query as unknown as catalogApi.GetEServiceDocumentsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
