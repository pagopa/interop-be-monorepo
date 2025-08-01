/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Attribute,
  generateId,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockedApiEservice,
} from "pagopa-interop-commons-test";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API /eservices/{eServiceId}/descriptors authorization test", () => {
  const attribute: Attribute = {
    name: "Attribute name",
    id: generateId(),
    kind: "Declared",
    description: "Attribute Description",
    creationTime: new Date(),
  };

  const descriptorSeed: catalogApi.EServiceDescriptorSeed = {
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id, explicitAttributeVerification: false }]],
      verified: [],
    },
    audience: ["http/test.test"],
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    docs: [
      {
        prettyName: "prettyName",
        contentType: "",
        documentId: generateId(),
        kind: "INTERFACE",
        serverUrls: [],
        checksum: "",
        fileName: "testName",
        filePath: "/test/test",
      },
    ],
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    version: "1",
    id: generateId(),
    serverUrls: [],
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id, explicitAttributeVerification: false }]],
      verified: [],
    },
    state: "DRAFT",
    audience: descriptorSeed.audience,
    voucherLifespan: descriptorSeed.voucherLifespan,
    dailyCallsPerConsumer: descriptorSeed.dailyCallsPerConsumer,
    dailyCallsTotal: descriptorSeed.dailyCallsTotal,
    docs: descriptorSeed.docs.map((doc) => ({
      path: doc.filePath,
      id: doc.documentId,
      name: doc.fileName,
      prettyName: doc.prettyName,
      contentType: doc.contentType,
      checksum: doc.checksum,
    })),
    agreementApprovalPolicy: descriptorSeed.agreementApprovalPolicy,
  };

  const mockApiEservice = getMockedApiEservice({
    descriptors: [mockApiDescriptor],
  });

  const mockM2MEserviceDescriptorResponse: m2mGatewayApi.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

  mockEserviceService.createDescriptor = vi
    .fn()
    .mockResolvedValue(mockM2MEserviceDescriptorResponse);

  const makeRequest = async (
    token: string,
    eserviceId: string,
    body: catalogApi.EServiceDescriptorSeed = descriptorSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eserviceId}/descriptors`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockApiEservice.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceDescriptorResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockApiEservice.id);

    expect(res.status).toBe(403);
  });

  it.each([
    { ...descriptorSeed, audience: undefined },
    { ...descriptorSeed, voucherLifespan: undefined },
    { ...descriptorSeed, dailyCallsPerConsumer: undefined },
    { ...descriptorSeed, dailyCallsTotal: undefined },
    { ...descriptorSeed, agreementApprovalPolicy: "INVALID_POLICY" },
    {
      ...descriptorSeed,
      docs: [
        {
          ...descriptorSeed.docs[0],
          kind: "INVALID_KIND",
        },
      ],
    },
    {
      ...descriptorSeed,
      attributes: {
        ...descriptorSeed.attributes,
        declared: undefined,
      },
    },
    {
      ...descriptorSeed,
      docs: undefined,
    },
  ])(
    "Should return 400 if passed an invalid Descriptor seed: %s",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockApiEservice.id,
        body as catalogApi.EServiceDescriptorSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([missingMetadata(), pollingMaxRetriesExceeded(3, 10)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockEserviceService.createDescriptor = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockApiEservice.id);

      expect(res.status).toBe(500);
    }
  );
});
