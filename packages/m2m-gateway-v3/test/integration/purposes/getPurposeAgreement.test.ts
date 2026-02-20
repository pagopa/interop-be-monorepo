import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId, PurposeId } from "pagopa-interop-models";
import {
  getMockedApiPurpose,
  getMockWithMetadata,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import {
  purposeService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { purposeAgreementNotFound } from "../../../src/model/errors.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("getPurposeAgreement", () => {
  const mockPurposeId: PurposeId = generateId();
  const mockPurpose = getMockWithMetadata(getMockedApiPurpose());
  const mockApiAgreement = getMockedApiAgreement({
    eserviceId: mockPurpose.data.eserviceId,
    consumerId: mockPurpose.data.consumerId,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteropBeClients.purposeProcessClient = {
      getPurpose: vi.fn().mockResolvedValue(mockPurpose),
    } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

    mockInteropBeClients.agreementProcessClient = {
      getAgreements: vi.fn().mockResolvedValue({
        data: {
          results: [mockApiAgreement],
          totalCount: 1,
        },
      }),
    } as unknown as PagoPAInteropBeClients["agreementProcessClient"];
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAgreementResponse: m2mGatewayApiV3.Agreement = {
      id: mockApiAgreement.id,
      eserviceId: mockApiAgreement.eserviceId,
      descriptorId: mockApiAgreement.descriptorId,
      producerId: mockApiAgreement.producerId,
      consumerId: mockApiAgreement.consumerId,
      state: mockApiAgreement.state,
      suspendedByConsumer: mockApiAgreement.suspendedByConsumer,
      suspendedByProducer: mockApiAgreement.suspendedByProducer,
      suspendedByPlatform: mockApiAgreement.suspendedByPlatform,
      consumerNotes: mockApiAgreement.consumerNotes,
      rejectionReason: mockApiAgreement.rejectionReason,
      createdAt: mockApiAgreement.createdAt,
      updatedAt: mockApiAgreement.updatedAt,
      suspendedAt: mockApiAgreement.suspendedAt,
    };

    const result = await purposeService.getPurposeAgreement(
      mockPurposeId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAgreementResponse);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockPurposeId },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreements,
      queries: {
        consumersIds: [mockPurpose.data.consumerId],
        exactConsumerIdMatch: true,
        eservicesIds: [mockPurpose.data.eserviceId],
        states: [
          m2mGatewayApiV3.AgreementState.Values.ACTIVE,
          m2mGatewayApiV3.AgreementState.Values.SUSPENDED,
        ],
        descriptorsIds: [],
        producersIds: [],
        showOnlyUpgradeable: false,
        offset: 0,
        limit: 1,
      },
    });
  });

  it("Should throw purposeAgreementNotFound if no agreement is found", async () => {
    mockInteropBeClients.agreementProcessClient.getAgreements = vi
      .fn()
      .mockResolvedValue({
        data: { results: [], totalCount: 0 },
      });

    await expect(
      purposeService.getPurposeAgreement(
        mockPurposeId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toEqual(purposeAgreementNotFound(mockPurposeId));
  });
});
