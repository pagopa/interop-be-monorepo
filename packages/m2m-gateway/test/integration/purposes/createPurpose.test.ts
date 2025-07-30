import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
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
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createPurpose", () => {
  const mockPurposeProcessGetResponse = getMockWithMetadata(
    getMockedApiPurpose()
  );

  const mockPurposeSeed: m2mGatewayApi.PurposeSeed = {
    dailyCalls: mockPurposeProcessGetResponse.data.versions[0].dailyCalls,
    description: mockPurposeProcessGetResponse.data.description,
    eserviceId: mockPurposeProcessGetResponse.data.eserviceId,
    isFreeOfCharge: mockPurposeProcessGetResponse.data.isFreeOfCharge,
    freeOfChargeReason: mockPurposeProcessGetResponse.data.freeOfChargeReason,
    title: mockPurposeProcessGetResponse.data.title,
    riskAnalysisForm: generateMock(m2mGatewayApi.RiskAnalysisFormSeed),
    delegationId: undefined,
  };

  const mockCreatePurpose = vi
    .fn()
    .mockResolvedValue(mockPurposeProcessGetResponse);
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockPurposeProcessGetResponse, 2)
  );
  const mockGetDelegation = vi.fn();

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    createPurpose: mockCreatePurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  mockInteropBeClients.delegationProcessClient = {
    delegation: { getDelegation: mockGetDelegation },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    mockCreatePurpose.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform service calls without delegationId", async () => {
    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
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
    };
    const mockAppContext = getMockM2MAdminAppContext();

    const result = await purposeService.createPurpose(
      mockPurposeSeed,
      mockAppContext
    );

    expect(result).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.createPurpose,
      body: {
        dailyCalls: mockPurposeSeed.dailyCalls,
        description: mockPurposeSeed.description,
        eServiceId: mockPurposeSeed.eserviceId,
        RiskAnalysisForm: mockPurposeSeed.riskAnalysisForm,
        isFreeOfCharge: mockPurposeSeed.isFreeOfCharge,
        freeOfChargeReason: mockPurposeSeed.freeOfChargeReason,
        title: mockPurposeSeed.title,
        consumerId: mockAppContext.authData.organizationId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(2);
    expect(
      mockInteropBeClients.delegationProcessClient.delegation.getDelegation
    ).toHaveBeenCalledTimes(0);
  });

  // TODO test delegation and test that purpose process is called with the right consumerId

  it("Should throw missingMetadata in case the purpose returned by the creation POST call has no metadata", async () => {
    mockCreatePurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    mockGetPurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(
        mockPurposeProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetPurpose).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
