/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenGenStatesApiClient,
  getMockTokenGenStatesConsumerClient,
  writeTokenGenStatesApiClient,
  writeTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClientId,
  clientKindTokenGenStates,
  generateId,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PurposeId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import {} from "pagopa-interop-client-assertion-validation";
import { genericLogger } from "pagopa-interop-commons";
import { fallbackAudit, retrieveKey } from "../src/services/tokenService.js";
import {
  fallbackAuditFailed,
  incompleteTokenGenerationStatesConsumerClient,
  tokenGenerationStatesEntryNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  dynamoDBClient,
  fileManager,
  getMockAuditMessage,
  mockKMSClient,
  mockProducer,
} from "./utils.js";

describe("unit tests", () => {
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
    mockKMSClient.send.mockImplementation(async () => ({
      Signature: "mock signature",
    }));
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
    vi.restoreAllMocks();
  });

  describe("retrieveKey", () => {
    it("should throw tokenGenerationStatesEntryNotFound if the clientKidPurpose entry doesn't exist in token-generation-states", async () => {
      const clientId1 = generateId<ClientId>();
      const kid = "kid";
      const purposeId1 = generateId<PurposeId>();
      const clientId2 = generateId<ClientId>();
      const purposeId2 = generateId<PurposeId>();

      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: clientId1,
          kid,
          purposeId: purposeId1,
        });

      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: clientId2,
          kid,
          purposeId: purposeId2,
        });

      const tokenClientPurposeEntry1: TokenGenerationStatesConsumerClient =
        getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1);

      await writeTokenGenStatesConsumerClient(
        tokenClientPurposeEntry1,
        dynamoDBClient
      );

      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPurposePK2)
      ).rejects.toThrowError(
        tokenGenerationStatesEntryNotFound(tokenClientKidPurposePK2)
      );
    });

    it("should throw tokenGenerationStatesEntryNotFound if the clientKid entry doesn't exist in token-generation-states", async () => {
      const clientId1 = generateId<ClientId>();
      const kid = "kid";
      const clientId2 = generateId<ClientId>();

      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: clientId1,
        kid,
      });

      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: clientId2,
        kid,
      });

      const tokenClientEntry1: TokenGenerationStatesApiClient =
        getMockTokenGenStatesApiClient(tokenClientKidPK1);

      await writeTokenGenStatesApiClient(tokenClientEntry1, dynamoDBClient);

      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPK2)
      ).rejects.toThrowError(
        tokenGenerationStatesEntryNotFound(tokenClientKidPK2)
      );
    });

    it("should throw invalidTokenClientKidPurposeEntry - clientKidPurpose entry - consumer key - missing info", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";
      const purposeId = generateId<PurposeId>();

      const tokenClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId,
          kid,
          purposeId,
        });

      const tokenClientPurposeEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
        agreementId: undefined,
      };

      await writeTokenGenStatesConsumerClient(
        tokenClientPurposeEntry,
        dynamoDBClient
      );
      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPurposePK)
      ).rejects.toThrowError(
        incompleteTokenGenerationStatesConsumerClient(
          tokenClientPurposeEntry.PK
        )
      );
    });

    it("should succeed - clientKidPurpose entry - consumer key", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";
      const purposeId = generateId<PurposeId>();

      const tokenClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId,
          kid,
          purposeId,
        });

      const tokenClientPurposeEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
        clientKind: clientKindTokenGenStates.consumer,
      };

      await writeTokenGenStatesConsumerClient(
        tokenClientPurposeEntry,
        dynamoDBClient
      );
      const key = await retrieveKey(dynamoDBClient, tokenClientKidPurposePK);

      expect(key).toEqual(tokenClientPurposeEntry);
    });

    it("should throw incompleteTokenGenerationStatesConsumerClient - clientKid entry with consumer key", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";

      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId,
        kid,
      });

      const tokenClientEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        clientKind: clientKindTokenGenStates.consumer,
      };

      await writeTokenGenStatesConsumerClient(tokenClientEntry, dynamoDBClient);
      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPK)
      ).rejects.toThrowError(
        incompleteTokenGenerationStatesConsumerClient(tokenClientEntry.PK)
      );
    });

    it("should succeed - clientKid entry - api key", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";

      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId,
        kid,
      });

      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        clientKind: clientKindTokenGenStates.api,
      };

      await writeTokenGenStatesApiClient(tokenClientEntry, dynamoDBClient);
      const key = await retrieveKey(dynamoDBClient, tokenClientKidPK);

      expect(key).toEqual(tokenClientEntry);
    });
  });

  describe("fallbackAudit", () => {
    it("should write the audit message to the file storage", async () => {
      const mockAuditMessage = getMockAuditMessage();

      const fileListBeforeAudit = await fileManager.listFiles(
        config.s3Bucket,
        genericLogger
      );
      expect(fileListBeforeAudit).toHaveLength(0);

      await fallbackAudit(mockAuditMessage, fileManager, genericLogger);

      const fileListAfterAudit = await fileManager.listFiles(
        config.s3Bucket,
        genericLogger
      );
      expect(fileListAfterAudit).toHaveLength(1);

      const fileContent = await fileManager.get(
        config.s3Bucket,
        fileListAfterAudit[0],
        genericLogger
      );

      const expectedFileContent = JSON.stringify(mockAuditMessage);

      const decodedFileContent = Buffer.from(fileContent).toString();
      expect(decodedFileContent).toEqual(expectedFileContent);
    });

    it("should throw fallbackAuditFailed in case of unsuccessful file write operation", async () => {
      const mockAuditMessage = getMockAuditMessage();

      mockProducer.send.mockImplementationOnce(async () => Promise.reject());
      vi.spyOn(fileManager, "storeBytes").mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(
        fallbackAudit(mockAuditMessage, fileManager, genericLogger)
      ).rejects.toThrowError(fallbackAuditFailed(mockAuditMessage.clientId));
    });
  });
});
