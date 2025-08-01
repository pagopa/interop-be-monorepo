import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  Attribute,
  EServiceId,
  generateId,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createDescriptor", () => {
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

  const mockEserviceDescriptorProcessResponse =
    getMockWithMetadata(mockApiDescriptor);

  const mockEserviceProcessResponse = getMockWithMetadata(mockApiEservice);

  const mockcreateDescriptor = vi.fn().mockResolvedValue({
    data: {
      eservice: mockApiEservice,
      descriptor: mockApiDescriptor,
    },
    metadata: { version: 0 },
  });

  const mockGetEservice = vi.fn(
    mockPollingResponse(mockEserviceProcessResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    createDescriptor: mockcreateDescriptor,
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockcreateDescriptor.mockClear();
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEserviceDescriptorResponse: m2mGatewayApi.EServiceDescriptor = {
      id: mockApiDescriptor.id,
      state: mockApiDescriptor.state,
      version: mockApiDescriptor.version,
      serverUrls: mockApiDescriptor.serverUrls,
      audience: mockApiDescriptor.audience,
      voucherLifespan: mockApiDescriptor.voucherLifespan,
      dailyCallsPerConsumer: mockApiDescriptor.dailyCallsPerConsumer,
      dailyCallsTotal: mockApiDescriptor.dailyCallsTotal,
      agreementApprovalPolicy: mockApiDescriptor.agreementApprovalPolicy,
    };

    const result = await eserviceService.createDescriptor(
      mockApiEservice.id as EServiceId,
      descriptorSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mEserviceDescriptorResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.createDescriptor,
      params: { eServiceId: mockEserviceProcessResponse.data.id },
      body: descriptorSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEserviceProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    mockcreateDescriptor.mockResolvedValueOnce({
      ...mockEserviceDescriptorProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.createDescriptor(
        mockApiEservice.id as EServiceId,
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetEservice.mockResolvedValueOnce({
      ...mockEserviceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.createDescriptor(
        mockApiEservice.id as EServiceId,
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEservice.mockImplementation(
      mockPollingResponse(
        mockEserviceProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.createDescriptor(
        mockApiEservice.id as EServiceId,
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEservice).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
