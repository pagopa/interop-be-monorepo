import { describe, it, expect, vi, beforeEach } from "vitest";
import { attributeRegistryApi, catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId, pollingMaxRetriesExceeded, unsafeBrandId } from "pagopa-interop-models";
import {
    getMockedApiEservice,
    getMockedApiEserviceDescriptor,
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
import { toM2MGatewayApiCertifiedAttribute } from "../../../src/api/attributeApiConverter.js";
import { genericLogger } from "pagopa-interop-commons";

describe("createEServiceDescriptorCertifiedAttributesGroup", () => {
    const attribute1: catalogApi.Attribute = {
        id: generateId(),
        explicitAttributeVerification: false,
    };

    const attribute2: catalogApi.Attribute = {
        id: generateId(),
        explicitAttributeVerification: false,
    };

    const attribute3: catalogApi.Attribute = {
        id: generateId(),
        explicitAttributeVerification: false,
    };

    const bulkAttribute1: attributeRegistryApi.Attribute = {
        code: "code1",
        id: attribute1.id,
        name: "Attribute Name 1",
        creationTime: new Date().toISOString(),
        description: "Description 1",
        origin: "Origin 1",
        kind: "CERTIFIED",
    };

    const bulkAttribute2: attributeRegistryApi.Attribute = {
        code: "code2",
        id: attribute2.id,
        name: "Attribute Name 2",
        creationTime: new Date().toISOString(),
        description: "Description 2",
        origin: "Origin 2",
        kind: "CERTIFIED",
    };

    const bulkAttribute3: attributeRegistryApi.Attribute = {
        code: "code3",
        id: attribute3.id,
        name: "Attribute Name 3",
        creationTime: new Date().toISOString(),
        description: "Description 3",
        origin: "Origin 3",
        kind: "CERTIFIED",
    };

    const descriptor: catalogApi.EServiceDescriptor = {
        ...getMockedApiEserviceDescriptor(),
        attributes: {
            certified: [[attribute1, attribute2, attribute3]],
            verified: [],
            declared: [],
        },
    };

    const seed: m2mGatewayApi.EServiceDescriptorAttributesGroupSeed = {
        attributeIds: [attribute1.id, attribute2.id, attribute3.id],
    };

    const eservice: catalogApi.EService = {
        ...getMockedApiEservice(),
        descriptors: [descriptor],
    };


    const response: m2mGatewayApi.EServiceDescriptorCertifiedAttribute[] = [
        {
            groupIndex: 1,
            attribute: toM2MGatewayApiCertifiedAttribute({
                attribute: bulkAttribute1,
                logger: genericLogger,
            }),
        },
        {
            groupIndex: 1,
            attribute: toM2MGatewayApiCertifiedAttribute({
                attribute: bulkAttribute2,
                logger: genericLogger,
            }),
        },
        {
            groupIndex: 1,
            attribute: toM2MGatewayApiCertifiedAttribute({
                attribute: bulkAttribute3,
                logger: genericLogger,
            }),
        },
    ];

    const mockEserviceProcessResponse = getMockWithMetadata(response);
    const mockGetEServiceById = vi.fn().mockResolvedValue(getMockWithMetadata(eservice));
    const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
        data: {
            results: [bulkAttribute1, bulkAttribute2, bulkAttribute3],
            totalCount: descriptor.attributes.certified.length,
        },
        metadata: {},
    });

    const mockUpdateDescriptorAttributes = vi
        .fn()
        .mockResolvedValue(mockEserviceProcessResponse);

    // const mockGetEserviceById = vi.fn(
    //     mockPollingResponse(eservice, 2)
    // );

    mockInteropBeClients.catalogProcessClient = {
        updateDescriptorAttributes: mockUpdateDescriptorAttributes,
        getEServiceById: mockGetEServiceById,
    } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

    mockInteropBeClients.attributeProcessClient = {
        getBulkedAttributes: mockGetBulkedAttributes,
    } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.only("Should succeed and perform API clients calls", async () => {

        const result = await eserviceService.createEServiceDescriptorCertifiedAttributesGroup(
            unsafeBrandId(eservice.id),
            unsafeBrandId(descriptor.id),
            seed,
            getMockM2MAdminAppContext()
        );


        expect(result).toEqual(response);
        // expectApiClientPostToHaveBeenCalledWith({
        //     mockPost: mockInteropBeClients.catalogProcessClient.createEService,
        //     body: mockEserviceSeed,
        // });
        // expectApiClientGetToHaveBeenCalledWith({
        //     mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
        //     params: { eServiceId: mockEserviceProcessResponse.data.id },
        // });
        // expect(
        //     mockInteropBeClients.catalogProcessClient.getEServiceById
        // ).toHaveBeenCalledTimes(2);
    });

    // it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    //     mockCreateEService.mockResolvedValueOnce({
    //         ...mockEserviceProcessResponse,
    //         metadata: undefined,
    //     });

    //     await expect(
    //         eserviceService.createEService(
    //             mockEserviceSeed,
    //             getMockM2MAdminAppContext()
    //         )
    //     ).rejects.toThrowError(missingMetadata());
    // });

    // it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    //     mockGetEservice.mockResolvedValueOnce({
    //         ...mockEserviceProcessResponse,
    //         metadata: undefined,
    //     });

    //     await expect(
    //         eserviceService.createEService(
    //             mockEserviceSeed,
    //             getMockM2MAdminAppContext()
    //         )
    //     ).rejects.toThrowError(missingMetadata());
    // });

    // it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    //     mockGetEservice.mockImplementation(
    //         mockPollingResponse(
    //             mockEserviceProcessResponse,
    //             config.defaultPollingMaxRetries + 1
    //         )
    //     );

    //     await expect(
    //         eserviceService.createEService(
    //             mockEserviceSeed,
    //             getMockM2MAdminAppContext()
    //         )
    //     ).rejects.toThrowError(
    //         pollingMaxRetriesExceeded(
    //             config.defaultPollingMaxRetries,
    //             config.defaultPollingRetryDelay
    //         )
    //     );
    //     expect(mockGetEservice).toHaveBeenCalledTimes(
    //         config.defaultPollingMaxRetries
    //     );
    // });
});
