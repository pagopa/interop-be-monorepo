/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenStatesClientEntry,
  getMockTokenStatesClientPurposeEntry,
} from "pagopa-interop-commons-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClientId,
  clientKidPrefix,
  clientKidPurposePrefix,
  clientKindTokenStates,
  generateId,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PurposeId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  ApiKey,
  ConsumerKey,
} from "pagopa-interop-client-assertion-validation";
import { retrieveKey } from "../src/services/tokenService.js";
import {
  invalidTokenClientKidPurposeEntry,
  keyTypeMismatch,
  tokenGenerationStatesEntryNotFound,
} from "../src/model/domain/errors.js";
import {
  dynamoDBClient,
  mockKMSClient,
  tokenGenerationCommonReadModelService,
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

      await tokenGenerationCommonReadModelService.writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry1
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

      const tokenClientEntry1: TokenGenerationStatesClientEntry =
        getMockTokenStatesClientEntry(tokenClientKidPK1);

      await tokenGenerationCommonReadModelService.writeTokenStateClientEntry(
        tokenClientEntry1
      );

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

      await tokenGenerationCommonReadModelService.writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry
      );
      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPurposePK)
      ).rejects.toThrowError(invalidTokenClientKidPurposeEntry());
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

      await tokenGenerationCommonReadModelService.writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry
      );
      const key = await retrieveKey(dynamoDBClient, tokenClientKidPurposePK);

      const expectedKey: ConsumerKey = {
        kid: tokenClientPurposeEntry.GSIPK_kid,
        purposeId: tokenClientPurposeEntry.GSIPK_purposeId!,
        clientId,
        consumerId: tokenClientPurposeEntry.consumerId,
        publicKey: tokenClientPurposeEntry.publicKey,
        algorithm: "RS256",
        clientKind: clientKindTokenStates.consumer,
        purposeState: {
          state: tokenClientPurposeEntry.purposeState!,
          versionId: tokenClientPurposeEntry.purposeVersionId!,
        },
        agreementId: tokenClientPurposeEntry.agreementId!,
        agreementState: {
          state: tokenClientPurposeEntry.agreementState!,
        },
        eServiceId: unsafeBrandId(
          tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[0]
        ),
        eServiceState: {
          state: tokenClientPurposeEntry.descriptorState!,
          descriptorId: unsafeBrandId(
            tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[1]
          ),
          audience: tokenClientPurposeEntry.descriptorAudience!,
          voucherLifespan: tokenClientPurposeEntry.descriptorVoucherLifespan!,
        },
      };

      expect(key).toEqual(expectedKey);
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

      await tokenGenerationCommonReadModelService.writeTokenStateClientEntry(
        tokenClientEntry
      );
      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPK)
      ).rejects.toThrowError(
        keyTypeMismatch(clientKidPrefix, clientKindTokenStates.consumer)
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

      await tokenGenerationCommonReadModelService.writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry
      );
      expect(
        retrieveKey(dynamoDBClient, tokenClientKidPurposePK)
      ).rejects.toThrowError(
        keyTypeMismatch(clientKidPurposePrefix, clientKindTokenStates.api)
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

      await tokenGenerationCommonReadModelService.writeTokenStateClientEntry(
        tokenClientEntry
      );
      const key = await retrieveKey(dynamoDBClient, tokenClientKidPK);

      const expectedKey: ApiKey = {
        kid: tokenClientEntry.GSIPK_kid,
        clientId,
        consumerId: tokenClientEntry.consumerId,
        publicKey: tokenClientEntry.publicKey,
        algorithm: "RS256",
        clientKind: clientKindTokenStates.api,
      };

      expect(key).toEqual(expectedKey);
    });
  });
  describe("generateInteropToken", () => {
    it("should generate a consumer token", () => {});
    it("should generate an api token", () => {});
    it("should throw tokenSigningFailed if the KMS signing operation fails", () => {});
  });
  describe("publishAudit", () => {
    it("should publish the message to Kafka", () => {});
    it("should trigger the fallback audit in case of unsuccessful Kafka write operation", () => {});
  });
  describe("fallbackAudit", () => {
    it("should write the audit message to the file storage", () => {});
    it("should throw fallbackAuditFailed in case of unsuccessful file write operation", () => {});
  });
});
