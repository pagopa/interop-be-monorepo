import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockedApiEserviceDoc,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceService,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("uploadEServiceDescriptorAsyncExchangeCallbackInterface", () => {
  const mockAddDocumentResponse = getMockWithMetadata(
    getMockedApiEserviceDoc({
      name: "callback.yaml",
    })
  );

  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockGetEServiceResponse = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockDescriptor],
      technology: catalogApi.EServiceTechnology.Values.REST,
    }),
    mockAddDocumentResponse.metadata.version
  );

  const mockFileUpload: m2mGatewayApiV3.FileUploadMultipart = {
    file: new File(
      [
        `openapi: "3.0.2"
info:
  version: 1.0.0
  title: Callback
paths: {}`,
      ],
      mockAddDocumentResponse.data.name,
      { type: mockAddDocumentResponse.data.contentType }
    ),
    prettyName: mockAddDocumentResponse.data.prettyName,
  };

  const mockCreateEServiceDocument = vi
    .fn()
    .mockResolvedValue(mockAddDocumentResponse);

  const mockGetEService = vi.fn(
    mockPollingResponse(mockGetEServiceResponse, 1)
  );

  mockInteropBeClients.catalogProcessClient = {
    createEServiceDocument: mockCreateEServiceDocument,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockCreateEServiceDocument.mockClear();
    mockGetEService.mockClear();
  });

  it("Should upload the document as an async exchange callback interface", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);

    const result =
      await eserviceService.uploadEServiceDescriptorAsyncExchangeCallbackInterface(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockDescriptor.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      );

    expect(result).toMatchObject({
      id: mockAddDocumentResponse.data.id,
      name: mockAddDocumentResponse.data.name,
      prettyName: mockAddDocumentResponse.data.prettyName,
    });

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.createEServiceDocument,
      body: expect.objectContaining({
        kind: catalogApi.EServiceDocumentKind.Values
          .ASYNC_EXCHANGE_CALLBACK_INTERFACE,
        serverUrls: [],
      }),
      params: {
        eServiceId: mockGetEServiceResponse.data.id,
        descriptorId: mockDescriptor.id,
      },
    });
  });
});
