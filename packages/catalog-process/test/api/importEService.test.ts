/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { EService, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  checksumDuplicate,
  documentIdDuplicate,
  documentPrettyNameDuplicate,
  eServiceNameDuplicateForProducer,
  eserviceNotInReceiveMode,
  eserviceTemplateNameConflict,
  inconsistentDailyCalls,
  invalidDelegationFlags,
  originNotCompliant,
  riskAnalysisDuplicated,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /import/eservices authorization test", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEservice: EService = {
    ...getMockEService(),
    descriptors: [mockDescriptor],
  };

  const serviceResponse = getMockWithMetadata({
    eservice: mockEservice,
    createdDescriptorId: mockDescriptor.id,
  });

  const apiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(mockEservice)
  );

  const importSeed: catalogApi.EServiceImportSeed = {
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
      interface: {
        documentId: generateId(),
        prettyName: "Interface",
        filePath: "interface/file/path",
        fileName: "api.yaml",
        contentType: "application/yaml",
        checksum: "interfaceChecksum",
        serverUrls: ["http://server.com"],
      },
      docs: [
        {
          documentId: generateId(),
          prettyName: "Document",
          filePath: "document/file/path",
          fileName: "doc.pdf",
          contentType: "application/pdf",
          checksum: "documentChecksum",
          serverUrls: [],
        },
      ],
    },
    riskAnalysis: [],
  };

  catalogService.importEService = vi.fn().mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    body: catalogApi.EServiceImportSeed = importSeed
  ) =>
    request(api)
      .post("/import/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        eservice: apiEservice,
        createdDescriptorId: mockDescriptor.id,
      });
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
      error: originNotCompliant("Not compliant origin"),
      expectedStatus: 403,
    },
    {
      error: eServiceNameDuplicateForProducer(
        mockEservice.name,
        mockEservice.producerId
      ),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplateNameConflict(mockEservice.id),
      expectedStatus: 409,
    },
    {
      error: riskAnalysisDuplicated("risk analysis name", mockEservice.id),
      expectedStatus: 409,
    },
    {
      error: documentPrettyNameDuplicate("prettyName", mockDescriptor.id),
      expectedStatus: 409,
    },
    {
      error: checksumDuplicate(mockEservice.id, mockDescriptor.id),
      expectedStatus: 409,
    },
    {
      error: documentIdDuplicate(generateId(), mockDescriptor.id),
      expectedStatus: 409,
    },
    {
      error: invalidDelegationFlags(false, true),
      expectedStatus: 400,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
    {
      error: eserviceNotInReceiveMode(mockEservice.id),
      expectedStatus: 400,
    },
    {
      error: riskAnalysisValidationFailed([]),
      expectedStatus: 400,
    },
    {
      error: tenantKindNotFound(mockEservice.producerId),
      expectedStatus: 400,
    },
    {
      error: tenantNotFound(mockEservice.producerId),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.importEService = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { ...importSeed, invalidParam: "invalidValue" },
    { ...importSeed, name: 1 },
    { ...importSeed, technology: "INVALID_TECH" },
    { ...importSeed, mode: "INVALID_MODE" },
    { ...importSeed, name: undefined },
    { ...importSeed, descriptor: undefined },
    { ...importSeed, riskAnalysis: undefined },
    {
      ...importSeed,
      descriptor: {
        ...importSeed.descriptor,
        docs: undefined,
      },
    },
    {
      ...importSeed,
      descriptor: {
        ...importSeed.descriptor,
        voucherLifespan: "not-a-number",
      },
    },
    {
      ...importSeed,
      descriptor: {
        ...importSeed.descriptor,
        interface: { documentId: "not-a-uuid" },
      },
    },
    {
      ...importSeed,
      descriptor: {
        ...importSeed.descriptor,
        agreementApprovalPolicy: "INVALID_POLICY",
      },
    },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    catalogService.importEService = vi.fn().mockResolvedValue(serviceResponse);

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as catalogApi.EServiceImportSeed);

    expect(res.status).toBe(400);
  });
});
