import { fail } from "assert";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { bigIntToDate, generateId } from "pagopa-interop-models";
import {
  DocumentSignatureReference,
  DocumentSignatureReferenceSchema,
  SignatureReference,
  SignatureReferenceSchema,
  genericLogger,
  signatureServiceBuilder,
} from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import { getUnixTime } from "date-fns";
import { dynamoDBClient } from "../utils/utils.js";
import { config } from "../../src/config/config.js";
import { FILE_KIND_CONFIG } from "../../src/utils/fileKind.config.js";

describe("signatureServiceBuilder - Integration Tests", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  it("should successfully delete logically and still retrieve it", async () => {
    const safeStorageId = generateId();
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const mockReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "multa.pdf",
      correlationId: generateId(),
      creationTimestamp: getUnixTime(new Date()),
      path: "path/to",
    };

    await signatureService.saveSignatureReference(mockReference, genericLogger);

    await signatureService.deleteSignatureReference(
      mockReference.safeStorageId,
      genericLogger
    );

    const retrievedItem = await signatureService.readSignatureReference(
      mockReference.safeStorageId,
      genericLogger
    );

    expect(retrievedItem).toEqual({
      ...mockReference,
      safeStorageId: mockReference.safeStorageId,
    });
  });

  it("should return undefined if a signature reference does not exist", async () => {
    const nonExistentId = generateId();
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const retrievedItem = await signatureService.readSignatureReference(
      nonExistentId,
      genericLogger
    );

    expect(retrievedItem).toBeUndefined();
  });

  it("should handle error when reading from DynamoDB", async () => {
    const brokenDynamoDBClient = new DynamoDBClient({
      region: "eu-south-1",
      endpoint: "http://localhost:9999",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
    const signatureService = signatureServiceBuilder(
      brokenDynamoDBClient,
      config
    );
    await expect(
      signatureService.readSignatureReference(generateId(), genericLogger)
    ).rejects.toThrow();
  });

  it("should successfully save and retrieve a SignatureReference with timestamp", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const safeStorageId = generateId();
    const mockReference: SignatureReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "contratto.pdf",
      correlationId: generateId(),
      creationTimestamp: getUnixTime(new Date()),
      path: "path/to",
    };

    await signatureService.saveSignatureReference(mockReference, genericLogger);

    const retrieved = await signatureService.readSignatureReference(
      safeStorageId,
      genericLogger
    );

    expect(retrieved).toBeDefined();
    expect(retrieved?.safeStorageId).toBe(mockReference.safeStorageId);
    expect(retrieved?.fileKind).toBe(mockReference.fileKind);
    expect(retrieved?.creationTimestamp).toBe(mockReference.creationTimestamp);
  });

  it("should throw genericInternalError if the item in DynamoDB is malformed", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const malformedId = "malformed-ID";

    const command = {
      TableName: config.signatureReferencesTableName,
      Item: {
        safeStorageId: { S: malformedId },
        fileName: { S: "invalid.pdf" },
        correlationId: { S: "correlation-1" },
        // 'fileKind' intentionally missing
      },
    };

    // Use the raw DynamoDB client to simulate a corrupted entry
    await dynamoDBClient.send(new PutItemCommand(command));

    const expectedMessage = `Error reading signature reference with id='${malformedId}' from table 'SignatureReferencesTable': Error: Malformed item in table 'SignatureReferencesTable' for id='${malformedId}'`;

    await expect(
      signatureService.readSignatureReference(malformedId, genericLogger)
    ).rejects.toThrow(expectedMessage);
  });

  it("should correctly set 'ttl' and 'logicallyDeleted' fields on deleteSignatureReference", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const safeStorageId = generateId();
    const mockReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "atto.pdf",
      correlationId: generateId(),
      path: "path/to",
    };

    await signatureService.saveSignatureReference(mockReference, genericLogger);

    await signatureService.deleteSignatureReference(
      mockReference.safeStorageId,
      genericLogger
    );

    // Read raw item from DynamoDB
    const result = await dynamoDBClient.send(
      new GetItemCommand({
        TableName: config.signatureReferencesTableName,
        Key: { safeStorageId: { S: safeStorageId } },
      })
    );

    const item = result.Item;

    expect(item).toBeDefined();
    expect(item?.ttl?.N).toBeDefined();
    expect(Number(item?.ttl?.N)).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(item?.logicallyDeleted?.BOOL ?? item?.logicallyDeleted?.N).toBe(
      true
    );
  });

  it("should save and retrieve both SignatureReference and DocumentSignatureReference independently", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);

    const sigRefId = generateId();
    const sigRef: SignatureReference = {
      safeStorageId: sigRefId,
      fileKind: "VOUCHER_AUDIT",
      fileName: "signature.pdf",
      correlationId: generateId(),
      creationTimestamp: getUnixTime(new Date()),
      path: "path/to",
    };

    const docSigRefId = generateId();
    const docSigRef: DocumentSignatureReference = {
      safeStorageId: docSigRefId,
      streamId: generateId(),
      subObjectId: generateId(),
      fileKind: "RISK_ANALYSIS_DOCUMENT",
      fileName: "document.pdf",
      prettyname: "Pretty Document",
      contentType: "application/pdf",
      correlationId: generateId(),
      version: 2,
      createdAt: BigInt(12345),
      creationTimestamp: getUnixTime(new Date()),
      path: "/some/path",
    };

    await signatureService.saveSignatureReference(sigRef, genericLogger);
    await signatureService.saveDocumentSignatureReference(
      docSigRef,
      genericLogger
    );

    const retrievedSigRef = await signatureService.readSignatureReference(
      sigRefId,
      genericLogger
    );
    const retrievedDocSigRef =
      await signatureService.readDocumentSignatureReference(
        docSigRefId,
        genericLogger
      );

    expect(retrievedSigRef).toBeDefined();
    expect(retrievedSigRef?.safeStorageId).toBe(sigRef.safeStorageId);
    expect(retrievedSigRef?.fileName).toBe(sigRef.fileName);

    expect(retrievedDocSigRef).toBeDefined();
    expect(retrievedDocSigRef?.safeStorageId).toBe(docSigRef.safeStorageId);
    expect(retrievedDocSigRef?.fileName).toBe(docSigRef.fileName);
    expect(retrievedDocSigRef?.prettyname).toBe(docSigRef.prettyname);

    expect(retrievedSigRef?.safeStorageId).not.toBe(
      retrievedDocSigRef?.safeStorageId
    );
  });

  it("should save and retrieve both SignatureReference and DocumentSignatureReference with readSignatureReferenceById", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);

    const sigRefId = generateId();
    const sigRef: SignatureReference = {
      safeStorageId: sigRefId,
      fileKind: "VOUCHER_AUDIT",
      fileName: "signature.pdf",
      correlationId: generateId(),
      creationTimestamp: getUnixTime(new Date()),
      path: "path/to",
    };

    const docSigRefId = generateId();
    const docSigRef: DocumentSignatureReference = {
      safeStorageId: docSigRefId,
      streamId: generateId(),
      subObjectId: generateId(),
      fileKind: "RISK_ANALYSIS_DOCUMENT",
      fileName: "document.pdf",
      prettyname: "Pretty Document",
      contentType: "application/pdf",
      correlationId: generateId(),
      version: 2,
      createdAt: BigInt(12345),
      creationTimestamp: getUnixTime(new Date()),
      path: "/some/path",
    };

    await signatureService.saveSignatureReference(sigRef, genericLogger);
    await signatureService.saveDocumentSignatureReference(
      docSigRef,
      genericLogger
    );

    const retrievedSigRef = await signatureService.readSignatureReferenceById(
      sigRefId,
      genericLogger
    );

    const retrievedDocSigRef =
      await signatureService.readSignatureReferenceById(
        docSigRefId,
        genericLogger
      );

    const { process } =
      FILE_KIND_CONFIG[
        retrievedDocSigRef?.fileKind as keyof typeof FILE_KIND_CONFIG
      ];

    if (process) {
      expect(
        DocumentSignatureReferenceSchema.parse(retrievedDocSigRef)
      ).toBeTruthy();
      const docSignature = retrievedDocSigRef as DocumentSignatureReference;
      expect(docSignature).toBeDefined();
      expect(docSignature.safeStorageId).toBe(docSigRef.safeStorageId);
      expect(docSignature.fileName).toBe(docSigRef.fileName);
      expect(docSignature.createdAt).toBe(docSigRef.createdAt);
      expect(bigIntToDate(docSignature.createdAt)).toBeInstanceOf(Date);
      expect(new Date(bigIntToDate(docSignature.createdAt))).toBeInstanceOf(
        Date
      );
    } else {
      fail("Casting of Document not successfull");
    }
    expect(SignatureReferenceSchema.parse(retrievedSigRef)).toBeTruthy();
    expect(retrievedSigRef).toBeDefined();
    expect(retrievedSigRef?.safeStorageId).toBe(sigRef.safeStorageId);
    expect(retrievedSigRef?.fileName).toBe(sigRef.fileName);

    expect(retrievedSigRef?.safeStorageId).not.toBe(
      retrievedDocSigRef?.safeStorageId
    );
  });

  it("should save and retrieve a DocumentSignatureReference for purpose template (RISK_ANALYSIS_TEMPLATE_DOCUMENT)", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);

    const purposeTemplateDocId = generateId();
    const purposeTemplateDocRef: DocumentSignatureReference = {
      safeStorageId: purposeTemplateDocId,
      streamId: generateId(), // purposeTemplateId
      subObjectId: generateId(), // documentId
      fileKind: "RISK_ANALYSIS_TEMPLATE_DOCUMENT",
      fileName: "risk_analysis_template.pdf",
      prettyname: "Risk Analysis Template Document",
      contentType: "application/pdf",
      correlationId: generateId(),
      version: 1,
      createdAt: BigInt(Date.now()),
      creationTimestamp: getUnixTime(new Date()),
      path: "/purpose-templates/documents/risk_analysis_template.pdf",
    };

    await signatureService.saveDocumentSignatureReference(
      purposeTemplateDocRef,
      genericLogger
    );

    const retrieved = await signatureService.readDocumentSignatureReference(
      purposeTemplateDocId,
      genericLogger
    );

    expect(retrieved).toBeDefined();
    expect(retrieved?.safeStorageId).toBe(purposeTemplateDocRef.safeStorageId);
    expect(retrieved?.fileKind).toBe("RISK_ANALYSIS_TEMPLATE_DOCUMENT");
    expect(retrieved?.streamId).toBe(purposeTemplateDocRef.streamId);
    expect(retrieved?.subObjectId).toBe(purposeTemplateDocRef.subObjectId);
    expect(retrieved?.fileName).toBe(purposeTemplateDocRef.fileName);
    expect(retrieved?.prettyname).toBe(purposeTemplateDocRef.prettyname);
    expect(retrieved?.createdAt).toBe(purposeTemplateDocRef.createdAt);
  });

  it("should correctly identify purpose template documents using readSignatureReferenceById and FILE_KIND_CONFIG", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);

    const purposeTemplateDocId = generateId();
    const purposeTemplateDocRef: DocumentSignatureReference = {
      safeStorageId: purposeTemplateDocId,
      streamId: generateId(),
      subObjectId: generateId(),
      fileKind: "RISK_ANALYSIS_TEMPLATE_DOCUMENT",
      fileName: "template_analysis.pdf",
      prettyname: "Template Analysis",
      contentType: "application/pdf",
      correlationId: generateId(),
      version: 1,
      createdAt: BigInt(Date.now()),
      creationTimestamp: getUnixTime(new Date()),
      path: "/templates/analysis/template_analysis.pdf",
    };

    await signatureService.saveDocumentSignatureReference(
      purposeTemplateDocRef,
      genericLogger
    );

    const retrieved = await signatureService.readSignatureReferenceById(
      purposeTemplateDocId,
      genericLogger
    );

    expect(retrieved).toBeDefined();
    expect(retrieved?.fileKind).toBe("RISK_ANALYSIS_TEMPLATE_DOCUMENT");

    const fileKindConfig =
      FILE_KIND_CONFIG[retrieved?.fileKind as keyof typeof FILE_KIND_CONFIG];
    expect(fileKindConfig).toBeDefined();
    expect(fileKindConfig.process).toBe("purposeTemplate");

    // Verify it parses as DocumentSignatureReference
    expect(DocumentSignatureReferenceSchema.parse(retrieved)).toBeTruthy();
    const docSignature = retrieved as DocumentSignatureReference;
    expect(docSignature.streamId).toBe(purposeTemplateDocRef.streamId);
    expect(docSignature.subObjectId).toBe(purposeTemplateDocRef.subObjectId);
  });

  it("should handle logical deletion for purpose template documents", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);

    const purposeTemplateDocId = generateId();
    const purposeTemplateDocRef: DocumentSignatureReference = {
      safeStorageId: purposeTemplateDocId,
      streamId: generateId(),
      subObjectId: generateId(),
      fileKind: "RISK_ANALYSIS_TEMPLATE_DOCUMENT",
      fileName: "deletable_template.pdf",
      prettyname: "Deletable Template",
      contentType: "application/pdf",
      correlationId: generateId(),
      version: 1,
      createdAt: BigInt(Date.now()),
      creationTimestamp: getUnixTime(new Date()),
      path: "/templates/deletable_template.pdf",
    };

    await signatureService.saveDocumentSignatureReference(
      purposeTemplateDocRef,
      genericLogger
    );

    await signatureService.deleteSignatureReference(
      purposeTemplateDocId,
      genericLogger
    );

    // Read raw item from DynamoDB to verify TTL and logicallyDeleted fields
    const result = await dynamoDBClient.send(
      new GetItemCommand({
        TableName: config.signatureReferencesTableName,
        Key: { safeStorageId: { S: purposeTemplateDocId } },
      })
    );

    const item = result.Item;
    expect(item).toBeDefined();
    expect(item?.ttl?.N).toBeDefined();
    expect(Number(item?.ttl?.N)).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(item?.logicallyDeleted?.BOOL ?? item?.logicallyDeleted?.N).toBe(
      true
    );
    expect(item?.fileKind?.S).toBe("RISK_ANALYSIS_TEMPLATE_DOCUMENT");
  });

  it("should distinguish between RISK_ANALYSIS_DOCUMENT and RISK_ANALYSIS_TEMPLATE_DOCUMENT", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);

    const riskAnalysisDocId = generateId();
    const riskAnalysisDoc: DocumentSignatureReference = {
      safeStorageId: riskAnalysisDocId,
      streamId: generateId(),
      subObjectId: generateId(),
      fileKind: "RISK_ANALYSIS_DOCUMENT",
      fileName: "risk_analysis.pdf",
      prettyname: "Risk Analysis",
      contentType: "application/pdf",
      correlationId: generateId(),
      version: 1,
      createdAt: BigInt(Date.now()),
      creationTimestamp: getUnixTime(new Date()),
      path: "/purposes/risk_analysis.pdf",
    };

    const templateDocId = generateId();
    const templateDoc: DocumentSignatureReference = {
      safeStorageId: templateDocId,
      streamId: generateId(),
      subObjectId: generateId(),
      fileKind: "RISK_ANALYSIS_TEMPLATE_DOCUMENT",
      fileName: "risk_analysis_template.pdf",
      prettyname: "Risk Analysis Template",
      contentType: "application/pdf",
      correlationId: generateId(),
      version: 1,
      createdAt: BigInt(Date.now()),
      creationTimestamp: getUnixTime(new Date()),
      path: "/templates/risk_analysis_template.pdf",
    };

    await signatureService.saveDocumentSignatureReference(
      riskAnalysisDoc,
      genericLogger
    );
    await signatureService.saveDocumentSignatureReference(
      templateDoc,
      genericLogger
    );

    const retrievedRiskAnalysis =
      await signatureService.readSignatureReferenceById(
        riskAnalysisDocId,
        genericLogger
      );
    const retrievedTemplate = await signatureService.readSignatureReferenceById(
      templateDocId,
      genericLogger
    );

    expect(retrievedRiskAnalysis?.fileKind).toBe("RISK_ANALYSIS_DOCUMENT");
    expect(retrievedTemplate?.fileKind).toBe("RISK_ANALYSIS_TEMPLATE_DOCUMENT");

    // Verify different process types in FILE_KIND_CONFIG
    const riskAnalysisConfig =
      FILE_KIND_CONFIG[
        retrievedRiskAnalysis?.fileKind as keyof typeof FILE_KIND_CONFIG
      ];
    const templateConfig =
      FILE_KIND_CONFIG[
        retrievedTemplate?.fileKind as keyof typeof FILE_KIND_CONFIG
      ];

    expect(riskAnalysisConfig.process).toBe("riskAnalysis");
    expect(templateConfig.process).toBe("purposeTemplate");
  });
});
