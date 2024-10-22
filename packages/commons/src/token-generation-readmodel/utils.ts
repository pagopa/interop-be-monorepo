import {
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { PutItemCommand, PutItemInput } from "@aws-sdk/client-dynamodb";
import { TokenGenerationReadModelRepository } from "../repositories/TokenGenerationReadModelRepository.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tokenGenerationCommonReadModelServiceBuilder(
  tokenGenerationReadModelRepository: TokenGenerationReadModelRepository
) {
  const dynamoDBClient = tokenGenerationReadModelRepository.dynamoDBClient;
  return {
    async writeTokenStateClientPurposeEntry(
      tokenStateEntry: TokenGenerationStatesClientPurposeEntry
    ): Promise<void> {
      const input: PutItemInput = {
        ConditionExpression: "attribute_not_exists(PK)",
        Item: {
          PK: {
            S: tokenStateEntry.PK,
          },
          ...(tokenStateEntry.descriptorState
            ? {
                descriptorState: {
                  S: tokenStateEntry.descriptorState,
                },
              }
            : {}),
          ...(tokenStateEntry.descriptorAudience
            ? {
                descriptorAudience: {
                  L: tokenStateEntry.descriptorAudience.map((item) => ({
                    S: item,
                  })),
                },
              }
            : {}),
          ...(tokenStateEntry.descriptorVoucherLifespan
            ? {
                descriptorVoucherLifespan: {
                  N: tokenStateEntry.descriptorVoucherLifespan.toString(),
                },
              }
            : {}),
          updatedAt: {
            S: tokenStateEntry.updatedAt,
          },
          consumerId: {
            S: tokenStateEntry.consumerId,
          },
          ...(tokenStateEntry.agreementId
            ? {
                agreementId: {
                  S: tokenStateEntry.agreementId,
                },
              }
            : {}),
          ...(tokenStateEntry.purposeVersionId
            ? {
                purposeVersionId: {
                  S: tokenStateEntry.purposeVersionId,
                },
              }
            : {}),
          ...(tokenStateEntry.GSIPK_consumerId_eserviceId
            ? {
                GSIPK_consumerId_eserviceId: {
                  S: tokenStateEntry.GSIPK_consumerId_eserviceId,
                },
              }
            : {}),
          clientKind: {
            S: tokenStateEntry.clientKind,
          },
          publicKey: {
            S: tokenStateEntry.publicKey,
          },
          GSIPK_clientId: {
            S: tokenStateEntry.GSIPK_clientId,
          },
          GSIPK_kid: {
            S: tokenStateEntry.GSIPK_kid,
          },
          ...(tokenStateEntry.GSIPK_clientId_purposeId
            ? {
                GSIPK_clientId_purposeId: {
                  S: tokenStateEntry.GSIPK_clientId_purposeId,
                },
              }
            : {}),
          ...(tokenStateEntry.agreementState
            ? {
                agreementState: {
                  S: tokenStateEntry.agreementState,
                },
              }
            : {}),
          ...(tokenStateEntry.GSIPK_eserviceId_descriptorId
            ? {
                GSIPK_eserviceId_descriptorId: {
                  S: tokenStateEntry.GSIPK_eserviceId_descriptorId,
                },
              }
            : {}),
          ...(tokenStateEntry.GSIPK_purposeId
            ? {
                GSIPK_purposeId: {
                  S: tokenStateEntry.GSIPK_purposeId,
                },
              }
            : {}),
          ...(tokenStateEntry.purposeState
            ? {
                purposeState: {
                  S: tokenStateEntry.purposeState,
                },
              }
            : {}),
        },
        TableName:
          tokenGenerationReadModelRepository.tokenGenerationStatesTableName,
      };
      const command = new PutItemCommand(input);
      await dynamoDBClient.send(command);
    },

    async writeTokenStateClientEntry(
      tokenStateEntry: TokenGenerationStatesClientEntry
    ): Promise<void> {
      const input: PutItemInput = {
        ConditionExpression: "attribute_not_exists(PK)",
        Item: {
          PK: {
            S: tokenStateEntry.PK,
          },
          updatedAt: {
            S: tokenStateEntry.updatedAt,
          },
          consumerId: {
            S: tokenStateEntry.consumerId,
          },
          clientKind: {
            S: tokenStateEntry.clientKind,
          },
          publicKey: {
            S: tokenStateEntry.publicKey,
          },
          GSIPK_clientId: {
            S: tokenStateEntry.GSIPK_clientId,
          },
          GSIPK_kid: {
            S: tokenStateEntry.GSIPK_kid,
          },
        },
        TableName:
          tokenGenerationReadModelRepository.tokenGenerationStatesTableName,
      };
      const command = new PutItemCommand(input);
      await dynamoDBClient.send(command);
    },
  };
}

export type TokenGenerationCommonReadModelService = ReturnType<
  typeof tokenGenerationCommonReadModelServiceBuilder
>;
