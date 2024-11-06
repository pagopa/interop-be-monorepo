/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenStatesClientEntry,
  getMockTokenStatesClientPurposeEntry,
  writeTokenStateClientEntry,
  writeTokenStateEntry,
} from "pagopa-interop-commons-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClientId,
  clientKindTokenStates,
  generateId,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PurposeId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import {} from "pagopa-interop-client-assertion-validation";
import { genericLogger } from "pagopa-interop-commons";
import { fallbackAudit, retrieveKey } from "../src/services/tokenService.js";
import {
  fallbackAuditFailed,
  invalidTokenClientKidPurposeEntry,
  keyTypeMismatch,
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

      const tokenClientPurposeEntry1: TokenGenerationStatesClientPurposeEntry =
        getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK1);

      await writeTokenStateEntry(tokenClientPurposeEntry1, dynamoDBClient);

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

      const tokenClientEntry1: TokenGenerationStatesClientEntry =
        getMockTokenStatesClientEntry(tokenClientKidPK1);

      await writeTokenStateClientEntry(tokenClientEntry1, dynamoDBClient);

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

      const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        agreementId: undefined,
      };

      await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient);
      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPurposePK)
      ).rejects.toThrowError(
        invalidTokenClientKidPurposeEntry(tokenClientPurposeEntry.PK)
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

      const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        clientKind: clientKindTokenStates.consumer,
      };

      await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient);
      const key = await retrieveKey(dynamoDBClient, tokenClientKidPurposePK);

      expect(key).toEqual(tokenClientPurposeEntry);
    });

    it("should throw keyTypeMismatch - clientKid entry with consumer key", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";

      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId,
        kid,
      });

      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        clientKind: clientKindTokenStates.consumer,
      };

      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);
      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPK)
      ).rejects.toThrowError(
        keyTypeMismatch(tokenClientEntry.PK, clientKindTokenStates.consumer)
      );
    });

    it("should throw keyTypeMismatch - clientKidPurpose entry with api key", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";
      const purposeId = generateId<PurposeId>();

      const tokenClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId,
          kid,
          purposeId,
        });

      const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        clientKind: clientKindTokenStates.api,
      };

      await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient);
      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPurposePK)
      ).rejects.toThrowError(
        keyTypeMismatch(tokenClientPurposeEntry.PK, clientKindTokenStates.api)
      );
    });

    it("should succeed - clientKid entry - api key", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";

      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId,
        kid,
      });

      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        clientKind: clientKindTokenStates.api,
      };

      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);
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
