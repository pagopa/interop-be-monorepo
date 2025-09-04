import { describe, it, expect, vi, beforeEach } from "vitest";
import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiAgreement,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  agreementService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("submitAgreement", () => {
  const mockAgreementProcessResponse = getMockWithMetadata(
    getMockedApiAgreement({
      state: agreementApi.AgreementState.Values.PENDING,
    })
  );

  const mockSubmitAgreementBody: m2mGatewayApi.AgreementSubmission = {
    consumerNotes: "This is a test reason for submission",
  };

  const mockSubmitAgreement = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);

  const mockGetAgreement = vi.fn(
    mockPollingResponse(
      mockAgreementProcessResponse,
      config.defaultPollingMaxRetries
    )
  );

  mockInteropBeClients.agreementProcessClient = {
    submitAgreement: mockSubmitAgreement,
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  mockInteropBeClients.delegationProcessClient = {
    delegation: {
      getDelegations: vi
        .fn()
        .mockResolvedValue(getMockWithMetadata({ results: [] })),
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockSubmitAgreement.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAgreementResponse: m2mGatewayApi.Agreement = {
      id: mockAgreementProcessResponse.data.id,
      eserviceId: mockAgreementProcessResponse.data.eserviceId,
      descriptorId: mockAgreementProcessResponse.data.descriptorId,
      producerId: mockAgreementProcessResponse.data.producerId,
      consumerId: mockAgreementProcessResponse.data.consumerId,
      state: mockAgreementProcessResponse.data.state,
      createdAt: mockAgreementProcessResponse.data.createdAt,
    };

    const result = await agreementService.submitAgreement(
      unsafeBrandId(mockAgreementProcessResponse.data.id),
      mockSubmitAgreementBody,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAgreementResponse);
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.agreementProcessClient.submitAgreement,
      params: {
        agreementId: mockAgreementProcessResponse.data.id,
      },
      body: mockSubmitAgreementBody,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: { agreementId: mockAgreementProcessResponse.data.id },
    });
  });

  it("Should throw missingMetadata in case the agreement returned by the submit agreement POST call has no metadata", async () => {
    mockSubmitAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.submitAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        mockSubmitAgreementBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the agreement returned by the polling GET call has no metadata", async () => {
    mockGetAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.submitAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        mockSubmitAgreementBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetAgreement.mockImplementation(
      mockPollingResponse(
        mockAgreementProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      agreementService.submitAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        mockSubmitAgreementBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
