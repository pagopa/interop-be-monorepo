import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgreementId, generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockWithMetadata,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { agreementApi } from "pagopa-interop-api-clients";
import {
  agreementService,
  expectApiClientGetToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";
import { DownloadedDocument } from "../../../src/utils/fileDownload.js";
import { agreementContractNotFound } from "../../../src/model/errors.js";
import { expectDownloadedDocumentToBeEqual } from "../../multipartTestUtils.js";

describe("downloadAgreementConsumerContract", () => {
  const testFileContent = "This is a mock contract file content.";
  const mockContractId = generateId();
  const mockContractName = "contract.pdf";

  const mockContract: agreementApi.Document = {
    id: mockContractId,
    name: mockContractName,
    path: `${config.agreementConsumerContractsPath}/${mockContractId}/${mockContractName}`,
    contentType: "application/pdf",
    prettyName: "Contratto",
    createdAt: new Date().toISOString(),
  };
  const mockAgreement = getMockedApiAgreement({
    contract: mockContract,
  });
  const mockAgreementId = unsafeBrandId<AgreementId>(mockAgreement.id);

  const mockAgreementProcessResponse = getMockWithMetadata(mockAgreement);
  const mockGetAgreementById = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);

  mockInteropBeClients.agreementProcessClient = {
    getAgreementById: mockGetAgreementById,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    mockGetAgreementById.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the contract file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.agreementConsumerDocumentsContainer,
        path: config.agreementConsumerContractsPath,
        resourceId: mockContract.id,
        name: mockContract.name,
        content: Buffer.from(testFileContent),
      },
      genericLogger
    );

    expect(
      (
        await fileManager.listFiles(
          config.agreementConsumerDocumentsContainer,
          genericLogger
        )
      ).at(0)
    ).toEqual(mockContract.path);

    const result = await agreementService.downloadAgreementConsumerContract(
      mockAgreementId,
      getMockM2MAdminAppContext()
    );

    const expectedServiceResponse: DownloadedDocument = {
      id: mockContract.id,
      file: new File([Buffer.from(testFileContent)], mockContract.name, {
        type: mockContract.contentType,
      }),
      prettyName: mockContract.prettyName,
    };
    await expectDownloadedDocumentToBeEqual(result, expectedServiceResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: { agreementId: mockAgreementId },
    });
  });

  it("should throw agreementContractNotFound error if the contract is not found", async () => {
    mockGetAgreementById.mockResolvedValue(
      getMockWithMetadata({
        ...mockAgreement,
        contract: undefined,
      })
    );

    await expect(
      agreementService.downloadAgreementConsumerContract(
        mockAgreementId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(agreementContractNotFound(mockAgreementId));
  });
});
