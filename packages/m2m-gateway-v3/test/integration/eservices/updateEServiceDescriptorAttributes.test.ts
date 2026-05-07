import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("updateEServiceDescriptorAttributes", () => {
  const mockAttributeId = generateId();
  const mockSeed: catalogApi.AttributesSeed = {
    certified: [
      [
        {
          id: mockAttributeId,
          explicitAttributeVerification: false,
          dailyCallsPerConsumer: 500,
        },
      ],
    ],
    declared: [],
    verified: [],
  };

  const draftDescriptor = getMockedApiEserviceDescriptor({
    state: catalogApi.EServiceDescriptorState.Values.DRAFT,
  });
  const publishedDescriptor = getMockedApiEserviceDescriptor({
    state: catalogApi.EServiceDescriptorState.Values.PUBLISHED,
  });
  const mockEService = getMockedApiEservice({
    descriptors: [draftDescriptor, publishedDescriptor],
  });
  const mockEServiceResponse = getMockWithMetadata(mockEService);

  const mockGetEService = vi.fn();
  const mockPatchUpdateDraftDescriptor = vi.fn();
  const mockUpdateDescriptorAttributes = vi.fn();

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    patchUpdateDraftDescriptor: mockPatchUpdateDraftDescriptor,
    updateDescriptorAttributes: mockUpdateDescriptorAttributes,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockGetEService.mockReset();
    mockPatchUpdateDraftDescriptor.mockReset();
    mockUpdateDescriptorAttributes.mockReset();
    mockPatchUpdateDraftDescriptor.mockResolvedValue(mockEServiceResponse);
    mockUpdateDescriptorAttributes.mockResolvedValue(mockEServiceResponse);
  });

  it("Should update draft descriptor attributes through patchUpdateDraftDescriptor", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceResponse)
      .mockImplementation(mockPollingResponse(mockEServiceResponse, 2));

    await eserviceService.updateEServiceDescriptorAttributes(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(draftDescriptor.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.patchUpdateDraftDescriptor,
      params: {
        eServiceId: mockEService.id,
        descriptorId: draftDescriptor.id,
      },
      body: { attributes: mockSeed },
    });
    expect(mockUpdateDescriptorAttributes).not.toHaveBeenCalled();
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(mockGetEService).toHaveBeenCalledTimes(3);
  });

  it("Should update non-draft descriptor attributes through updateDescriptorAttributes", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceResponse)
      .mockImplementation(mockPollingResponse(mockEServiceResponse, 2));

    await eserviceService.updateEServiceDescriptorAttributes(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(publishedDescriptor.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.updateDescriptorAttributes,
      params: {
        eServiceId: mockEService.id,
        descriptorId: publishedDescriptor.id,
      },
      body: mockSeed,
    });
    expect(mockPatchUpdateDraftDescriptor).not.toHaveBeenCalled();
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(mockGetEService).toHaveBeenCalledTimes(3);
  });

  it("Should throw missingMetadata in case the update response has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockEServiceResponse);
    mockUpdateDescriptorAttributes.mockResolvedValueOnce({
      ...mockEServiceResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateEServiceDescriptorAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(publishedDescriptor.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceResponse)
      .mockImplementation(
        mockPollingResponse(
          mockEServiceResponse,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      eserviceService.updateEServiceDescriptorAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(publishedDescriptor.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
  });
});
