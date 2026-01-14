import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateMock } from "@anatine/zod-mock";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  invalidSeedForPurposeFromTemplate,
  missingMetadata,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateDraftPurpose", () => {
  const mockPurposeWithTemplate = getMockedApiPurpose();
  const mockPurpose = {
    ...mockPurposeWithTemplate,
    purposeTemplateId: undefined,
  };
  const mockPurposeProcessGetResponseWithTemplate = getMockWithMetadata(
    mockPurposeWithTemplate
  );
  const mockPurposeProcessGetResponse = getMockWithMetadata(mockPurpose);

  const mockPurposeSeed: m2mGatewayApiV3.PurposeDraftUpdateSeed = {
    title: "updated title",
    description: "updated description",
    dailyCalls: 99,
    isFreeOfCharge: false,
    freeOfChargeReason: null,
    riskAnalysisForm: generateMock(m2mGatewayApiV3.RiskAnalysisFormSeed),
  };
  const mockPurposeSeedFromTemplate: m2mGatewayApiV3.PurposeDraftFromTemplateUpdateSeed =
  {
    title: mockPurposeSeed.title,
    riskAnalysisForm: mockPurposeSeed.riskAnalysisForm,
    dailyCalls: mockPurposeSeed.dailyCalls,
  };

  const mockPatchUpdatePurposeFromTemplate = vi
    .fn()
    .mockResolvedValue(mockPurposeProcessGetResponseWithTemplate);
  const mockPatchUpdatePurpose = vi
    .fn()
    .mockResolvedValue(mockPurposeProcessGetResponse);
  const mockGetPurpose = vi.fn();

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    patchUpdatePurposeFromTemplate: mockPatchUpdatePurposeFromTemplate,
    patchUpdatePurpose: mockPatchUpdatePurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockPatchUpdatePurposeFromTemplate.mockClear();
    mockPatchUpdatePurpose.mockClear();
    mockGetPurpose.mockReset();
  });

  it("Should succeed and perform service calls", async () => {
    mockGetPurpose
      .mockResolvedValueOnce(mockPurposeProcessGetResponse)
      .mockImplementation(
        mockPollingResponse(mockPurposeProcessGetResponse, 2)
      );

    const result = await purposeService.updateDraftPurpose(
      unsafeBrandId(mockPurpose.id),
      mockPurposeSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MPurpose: m2mGatewayApiV3.Purpose = {
      consumerId: mockPurposeProcessGetResponse.data.consumerId,
      createdAt: mockPurposeProcessGetResponse.data.createdAt,
      description: mockPurposeProcessGetResponse.data.description,
      eserviceId: mockPurposeProcessGetResponse.data.eserviceId,
      id: mockPurposeProcessGetResponse.data.id,
      isFreeOfCharge: mockPurposeProcessGetResponse.data.isFreeOfCharge,
      isRiskAnalysisValid:
        mockPurposeProcessGetResponse.data.isRiskAnalysisValid,
      title: mockPurposeProcessGetResponse.data.title,
      currentVersion: mockPurposeProcessGetResponse.data.versions.at(0),
      delegationId: mockPurposeProcessGetResponse.data.delegationId,
      freeOfChargeReason: mockPurposeProcessGetResponse.data.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockPurposeProcessGetResponse.data.updatedAt,
      waitingForApprovalVersion: undefined,
      purposeTemplateId: mockPurposeProcessGetResponse.data.purposeTemplateId,
    };

    expect(result).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.patchUpdatePurpose,
      params: {
        id: mockPurpose.id,
      },
      body: mockPurposeSeed,
    });
    expect(
      mockInteropBeClients.purposeProcessClient.patchUpdatePurposeFromTemplate
    ).toHaveBeenCalledTimes(0);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 3,
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(3);
  });

  it("Should succeed and perform service calls for purpose created from template", async () => {
    mockGetPurpose
      .mockResolvedValueOnce(mockPurposeProcessGetResponseWithTemplate)
      .mockImplementation(
        mockPollingResponse(mockPurposeProcessGetResponseWithTemplate, 2)
      );

    const result = await purposeService.updateDraftPurpose(
      unsafeBrandId(mockPurpose.id),
      mockPurposeSeedFromTemplate,
      getMockM2MAdminAppContext()
    );

    const expectedM2MPurpose: m2mGatewayApiV3.Purpose = {
      consumerId: mockPurposeProcessGetResponseWithTemplate.data.consumerId,
      createdAt: mockPurposeProcessGetResponseWithTemplate.data.createdAt,
      description: mockPurposeProcessGetResponseWithTemplate.data.description,
      eserviceId: mockPurposeProcessGetResponseWithTemplate.data.eserviceId,
      id: mockPurposeProcessGetResponseWithTemplate.data.id,
      isFreeOfCharge:
        mockPurposeProcessGetResponseWithTemplate.data.isFreeOfCharge,
      isRiskAnalysisValid:
        mockPurposeProcessGetResponseWithTemplate.data.isRiskAnalysisValid,
      title: mockPurposeProcessGetResponseWithTemplate.data.title,
      currentVersion:
        mockPurposeProcessGetResponseWithTemplate.data.versions.at(0),
      delegationId: mockPurposeProcessGetResponseWithTemplate.data.delegationId,
      freeOfChargeReason:
        mockPurposeProcessGetResponseWithTemplate.data.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockPurposeProcessGetResponseWithTemplate.data.updatedAt,
      waitingForApprovalVersion: undefined,
      purposeTemplateId:
        mockPurposeProcessGetResponseWithTemplate.data.purposeTemplateId,
    };

    expect(result).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeProcessClient
          .patchUpdatePurposeFromTemplate,
      params: {
        purposeId: mockPurposeWithTemplate.id,
        purposeTemplateId: mockPurposeWithTemplate.purposeTemplateId,
      },
      body: mockPurposeSeedFromTemplate,
    });
    expect(
      mockInteropBeClients.purposeProcessClient.patchUpdatePurpose
    ).toHaveBeenCalledTimes(0);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 3,
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(3);
  });

  it("Should throw invalidSeedForPurposeFromTemplate when the update seed is not for a purpose created from a purpose template", async () => {
    mockGetPurpose.mockResolvedValueOnce(
      mockPurposeProcessGetResponseWithTemplate
    );

    await expect(
      purposeService.updateDraftPurpose(
        unsafeBrandId(mockPurpose.id),
        mockPurposeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      invalidSeedForPurposeFromTemplate(
        m2mGatewayApiV3.PurposeDraftFromTemplateUpdateSeed.safeParse(
          mockPurposeSeed
        ).error!.issues.map((i) => i.message)
      )
    );

    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(1);
  });

  it("Should throw missingMetadata in case the purpose returned by the PATCH call has no metadata", async () => {
    mockGetPurpose.mockResolvedValueOnce(mockPurposeProcessGetResponse);
    mockPatchUpdatePurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.updateDraftPurpose(
        unsafeBrandId(mockPurpose.id),
        mockPurposeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());

    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(1);
  });

  it("Should throw missingMetadata in case the purpose created from template returned by the PATCH call has no metadata", async () => {
    mockGetPurpose.mockResolvedValueOnce(
      mockPurposeProcessGetResponseWithTemplate
    );
    mockPatchUpdatePurposeFromTemplate.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponseWithTemplate,
      metadata: undefined,
    });

    await expect(
      purposeService.updateDraftPurpose(
        unsafeBrandId(mockPurpose.id),
        mockPurposeSeedFromTemplate,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    mockGetPurpose
      .mockResolvedValueOnce(mockPurposeProcessGetResponse)
      .mockResolvedValueOnce({
        ...mockPurposeProcessGetResponse,
        metadata: undefined,
      });

    await expect(
      purposeService.updateDraftPurpose(
        unsafeBrandId(mockPurpose.id),
        mockPurposeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurpose
      .mockResolvedValueOnce(mockPurposeProcessGetResponse)
      .mockImplementation(
        mockPollingResponse(
          mockPurposeProcessGetResponse,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      purposeService.updateDraftPurpose(
        unsafeBrandId(mockPurpose.id),
        mockPurposeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetPurpose).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });
});
