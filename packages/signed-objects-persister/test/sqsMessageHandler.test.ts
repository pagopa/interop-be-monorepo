import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileManager, Logger } from "pagopa-interop-commons";
import { Message } from "@aws-sdk/client-sqs";
import { SafeStorageService } from "../src/services/safeStorageClient.js";
import { DbServiceBuilder } from "../src/services/dynamoService.js";
import { sqsMessageHandler } from "../src/handlers/sqsMessageHandler.js";

// Mock del modulo di configurazione per evitare dipendenze esterne
vi.mock("../src/config/config.js", () => ({
  config: {
    serviceName: "test-service",
    s3Bucket: "test-bucket",
    dbTableName: "test-table",
  },
}));

// Mock dei servizi esterni
// Usa 'Partial' per creare un oggetto mockato che implementa solo i metodi necessari
const mockFileManager: Partial<FileManager> = {
  storeBytes: vi.fn(),
};

const mockDbService: DbServiceBuilder = {
  deleteFromDynamo: vi.fn(),
};

const mockSafeStorageService: SafeStorageService = {
  getFile: vi.fn(),
  downloadFileContent: vi.fn(),
};

// Aggiungi il metodo isDebugEnabled al tuo mock
const mockLogger: Partial<Logger> = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  isDebugEnabled: vi.fn(() => false), // <--- Aggiungi questa riga
};

describe("sqsMessageHandler", () => {
  // Reset dei mock prima di ogni test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process the message successfully and delete the record", async () => {
    // 1. Dati di test e setup dei mock
    const sqsMessageBody = {
      version: "0",
      id: "6e902b1c-7f55-4074-a036-749e75551f33",
      "detail-type": "Object Created",
      source: "aws.s3",
      account: "123456789012",
      time: "2025-01-01T10:00:00Z",
      region: "eu-central-1",
      resources: ["arn:aws:s3:::some-bucket"],
      detail: {
        key: "test-file-key.pdf",
        versionId: "12345",
        documentType: "INTEROP_LEGAL_FACTS",
        documentStatus: "SAVED",
        contentType: "application/pdf",
        checksum: "mock-checksum",
        retentionUntil: "2026-01-01T10:00:00Z",
        tags: null,
        client_short_code: "12345",
      },
    };

    const sqsMessagePayload: Message = {
      Body: JSON.stringify(sqsMessageBody),
    };

    const mockFileReference = {
      download: { url: "http://mock-download-url.com/file" },
    };
    const mockFileContent = Buffer.from("test content");
    const mockS3Key = "12345/2025/01/01/test-file-key.pdf";

    // Imposta i mock per le chiamate ai servizi
    (mockSafeStorageService.getFile as vi.Mock).mockResolvedValueOnce(
      mockFileReference
    );
    (
      mockSafeStorageService.downloadFileContent as vi.Mock
    ).mockResolvedValueOnce(mockFileContent);
    (mockFileManager.storeBytes as vi.Mock).mockResolvedValueOnce(mockS3Key);
    (mockDbService.deleteFromDynamo as vi.Mock).mockResolvedValueOnce(void 0);

    // 2. Esegui la funzione da testare
    await sqsMessageHandler(
      sqsMessagePayload,
      mockFileManager as FileManager,
      mockDbService,
      mockSafeStorageService
    );

    // 3. Verifiche (Assertions)
    expect(mockSafeStorageService.getFile).toHaveBeenCalledWith(
      sqsMessageBody.detail.key
    );

    expect(mockFileManager.storeBytes).toHaveBeenCalledWith(
      {
        bucket: "test-bucket",
        path: "12345/2025/01/01",
        name: "test-file-key.pdf",
        content: mockFileContent,
      },
      expect.any(Object)
    );

    expect(mockDbService.deleteFromDynamo).toHaveBeenCalledWith(
      sqsMessageBody.id
    );
  });

  it("should throw an error and not call other services if the SQS message is invalid", async () => {
    // 1. Dati di test e setup
    const invalidSqsMessagePayload: Message = {
      Body: JSON.stringify({ invalid: "payload" }),
    };

    // 2. Esegui la funzione e verifica che lanci un errore
    await expect(
      sqsMessageHandler(
        invalidSqsMessagePayload,
        mockFileManager as FileManager,
        mockDbService,
        mockSafeStorageService
      )
    ).rejects.toThrow("Invalid SQS payload");

    // 3. Verifiche (Assertions)
    // Assicurati che nessuno dei servizi di business sia stato chiamato
    expect(mockSafeStorageService.getFile).not.toHaveBeenCalled();
    expect(mockFileManager.storeBytes).not.toHaveBeenCalled();
    expect(mockDbService.deleteFromDynamo).not.toHaveBeenCalled();

    // Opzionale: verifica che un errore sia stato registrato dal logger
    // Dato che il logger è interno al handler, potresti doverlo mockare diversamente
  });
});
