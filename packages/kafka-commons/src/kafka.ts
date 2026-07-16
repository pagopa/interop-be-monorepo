import type { CommonConstructorConfig } from "@confluentinc/kafka-javascript/types/kafkajs.js";
import { KafkaJS } from "@confluentinc/kafka-javascript";
import {
  generateAuthTokenFromRole,
  type GenerateAuthTokenResponse,
} from "aws-msk-iam-sasl-signer-js";

import type { KafkaConfig } from "./config/config.js";
import { Logger } from "pagopa-interop-commons";

type MskAuth = NonNullable<KafkaConfig["mskAuth"]>;

export async function initKafka(
  config: KafkaConfig,
  logger: Logger
): Promise<KafkaJS.Kafka> {
  const { mskAuth, kafkaBrokerConnectionString } = config;
  const saslConfigs: CommonConstructorConfig = kafkaBrokerConnectionString
    ? {
        "security.protocol": "sasl_ssl",
        "sasl.mechanism": "PLAIN",
        "sasl.username": "$ConnectionString",
        "sasl.password": config.kafkaBrokerConnectionString,
      }
    : mskAuth
      ? {
          oauthbearer_token_refresh_cb: async () => {
            const tokenResponse = await oauthBearerTokenProvider(
              mskAuth,
              logger
            );
            return {
              lifetime: tokenResponse.expiryTime,
              tokenValue: tokenResponse.token,
            };
          },
          "sasl.mechanism": "OAUTHBEARER",
          "security.protocol": "sasl_ssl",
        }
      : {};

  if (kafkaBrokerConnectionString) {
    logger.warn(
      "Using connection string mechanism for Kafka Broker authentication - this will override other mechanisms. If that is not desired, remove Kafka broker connection string from env variables."
    );
  }

  return new KafkaJS.Kafka({
    "bootstrap.servers": config.kafkaBrokers,
    "client.id": config.kafkaClientId,
    log_level: config.kafkaLogLevel,
    ...saslConfigs,
  });
}

async function oauthBearerTokenProvider(
  mskAuth: MskAuth,
  logger: Logger
): Promise<GenerateAuthTokenResponse> {
  logger.debug("Fetching token from AWS");

  const authTokenResponse = await generateAuthTokenFromRole({
    awsRoleArn: mskAuth.awsRoleArn,
    awsRoleSessionName: mskAuth.awsRoleSessionName,
    region: mskAuth.awsRegion,
  });

  logger.debug(
    `Token fetched from AWS expires at ${authTokenResponse.expiryTime}`
  );

  return authTokenResponse;
}
