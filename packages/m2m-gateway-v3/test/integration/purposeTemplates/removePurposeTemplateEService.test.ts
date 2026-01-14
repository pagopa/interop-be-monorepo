import {
    getMockedApiEServiceDescriptorPurposeTemplate,
    getMockedApiPurposeTemplate,
    getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
    EServiceId,
    generateId,
    pollingMaxRetriesExceeded,
    unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
    expectApiClientGetToHaveBeenCalledWith,
    expectApiClientPostToHaveBeenCalledWith,
    mockDeletionPollingResponse,
    mockInteropBeClients,
    purposeTemplateService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("removePurposeTemplateEService", () => {
    const eserviceId1 = generateId<EServiceId>();
    const mockPurposeTemplate = getMockedApiPurposeTemplate();

    const mockApiEServiceDescriptorPurposeTemplate1 = {
        ...getMockedApiEServiceDescriptorPurposeTemplate(),
        eserviceId: eserviceId1,
        purposeTemplateId: mockPurposeTemplate.id,
    };

    const mockVersion = 2;
    const mockUnlinkEServicesFromPurposeTemplateResponse = getMockWithMetadata(
        [mockApiEServiceDescriptorPurposeTemplate1],
        mockVersion
    );

    const mockUnlinkEServicesFromPurposeTemplate = vi
        .fn()
        .mockResolvedValue(mockUnlinkEServicesFromPurposeTemplateResponse);

    const mockPollRetries = 2;
    const mockGetPurposeTemplateEServiceDescriptorResponse = getMockWithMetadata(
        mockApiEServiceDescriptorPurposeTemplate1,
        2
    );
    const mockGetPurposeTemplateEServiceDescriptor = vi.fn(
        mockDeletionPollingResponse(
            mockGetPurposeTemplateEServiceDescriptorResponse,
            mockPollRetries
        )
    );

    mockInteropBeClients.purposeTemplateProcessClient = {
        unlinkEServicesFromPurposeTemplate: mockUnlinkEServicesFromPurposeTemplate,
        getPurposeTemplateEServiceDescriptor:
            mockGetPurposeTemplateEServiceDescriptor,
    } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

    beforeEach(() => {
        // Clear mock counters and call information before each test
        mockUnlinkEServicesFromPurposeTemplate.mockClear();
        mockGetPurposeTemplateEServiceDescriptor.mockClear();
    });

    it("Should succeed and perform API clients calls", async () => {
        await purposeTemplateService.removePurposeTemplateEService(
            unsafeBrandId(mockPurposeTemplate.id),
            eserviceId1,
            getMockM2MAdminAppContext()
        );

        expectApiClientPostToHaveBeenCalledWith({
            mockPost:
                mockInteropBeClients.purposeTemplateProcessClient
                    .unlinkEServicesFromPurposeTemplate,
            params: {
                id: mockPurposeTemplate.id,
            },
            body: {
                eserviceIds: [eserviceId1],
            },
        });
        expect(mockUnlinkEServicesFromPurposeTemplate).toHaveBeenCalledOnce();

        expectApiClientGetToHaveBeenCalledWith({
            mockGet:
                mockInteropBeClients.purposeTemplateProcessClient
                    .getPurposeTemplateEServiceDescriptor,
            params: { id: mockPurposeTemplate.id, eserviceId: eserviceId1 },
        });
        expect(mockGetPurposeTemplateEServiceDescriptor).toHaveBeenCalledTimes(
            mockPollRetries
        );
    });

    it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
        mockGetPurposeTemplateEServiceDescriptor.mockImplementation(
            mockDeletionPollingResponse(
                mockGetPurposeTemplateEServiceDescriptorResponse,
                config.defaultPollingMaxRetries + 1
            )
        );

        await expect(
            purposeTemplateService.removePurposeTemplateEService(
                unsafeBrandId(mockPurposeTemplate.id),
                eserviceId1,
                getMockM2MAdminAppContext()
            )
        ).rejects.toThrowError(
            pollingMaxRetriesExceeded(
                config.defaultPollingMaxRetries,
                config.defaultPollingRetryDelay
            )
        );
        expect(mockGetPurposeTemplateEServiceDescriptor).toHaveBeenCalledTimes(
            config.defaultPollingMaxRetries
        );
    });
});
