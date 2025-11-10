/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
import {
  FileManager,
  formatDateyyyyMMdd,
  formatTimehhmmss,
  InteropConsumerToken,
  Logger,
  secondsToMilliseconds,
} from "pagopa-interop-commons";
import { initProducer } from "kafka-iam-auth";
import {
  ClientAssertion,
  CorrelationId,
  DescriptorId,
  DPoPProof,
  EServiceId,
  FullTokenGenerationStatesConsumerClient,
  GeneratedTokenAuditDetails,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { AuthorizationServerConfig } from "../config/config.js";
import {
  fallbackAuditFailed,
  kafkaAuditingFailed,
} from "../model/domain/errors.js";

type Producer = Awaited<ReturnType<typeof initProducer>>;

export class AuditService {
  private producer: Producer | null = null;
  private reconnectInProgress = false;

  private constructor(
    private config: AuthorizationServerConfig,
    private topic: string,
    private fileManager: FileManager,
    private logger: Logger
  ) {}

  public static async create(
    config: AuthorizationServerConfig,
    topic: string,
    fileManager: FileManager,
    logger: Logger
  ): Promise<AuditService> {
    const service = new AuditService(config, topic, fileManager, logger);
    await service.tryConnectProducer();
    if (!service.producer) {
      service.startReconnectLoop();
    }
    return service;
  }

  public async publishAudit({
    eserviceId,
    descriptorId,
    generatedToken,
    key,
    clientAssertion,
    dpop,
    correlationId,
  }: {
    eserviceId: EServiceId;
    descriptorId: DescriptorId;
    generatedToken: InteropConsumerToken;
    key: FullTokenGenerationStatesConsumerClient;
    clientAssertion: ClientAssertion;
    dpop: DPoPProof | undefined;
    correlationId: CorrelationId;
  }): Promise<void> {
    const messageBody = this.generateMessageBody({
      eserviceId,
      descriptorId,
      generatedToken,
      key,
      clientAssertion,
      dpop,
      correlationId,
    });

    if (!this.producer) {
      this.logger.error("Kafka producer not available, going through fallback");
      await this.fallbackToS3(messageBody);
      return;
    }

    try {
      const res = await this.producer.send({
        messages: [
          {
            key: generatedToken.payload.jti,
            value: JSON.stringify(messageBody),
          },
        ],
      });
      if (res.length === 0 || res[0].errorCode !== 0) {
        throw kafkaAuditingFailed();
      }
    } catch (e) {
      this.logger.error("Main auditing flow failed, going through fallback");
      await this.fallbackToS3(messageBody);
    }
  }

  private async tryConnectProducer(): Promise<void> {
    try {
      this.producer = await initProducer(this.config, this.topic);
      this.logger.info("Kafka producer connected");
    } catch (e) {
      this.logger.error(`Initial Kafka connect failed: ${String(e)}`);
    }
  }

  private startReconnectLoop(): void {
    if (this.reconnectInProgress || this.producer) {
      return;
    }
    this.reconnectInProgress = true;

    const baseInterval =
      this.config.kafkaProducerReconnectBaseIntervalMs ?? 5000;
    let attempt = 0;

    const loop = async (): Promise<void> => {
      while (!this.producer) {
        attempt++;
        try {
          this.producer = await initProducer(this.config, this.topic);
          this.logger.info(
            `Kafka producer connected after ${attempt} attempt(s)`
          );
        } catch (e) {
          const delay = baseInterval * Math.min(attempt, 6);
          this.logger.error(
            `Kafka reconnect failed (attempt ${attempt}). Retry in ${delay}ms. Error: ${String(
              e
            )}`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      this.reconnectInProgress = false;
    };

    void loop();
  }

  private generateMessageBody({
    eserviceId,
    descriptorId,
    generatedToken,
    key,
    clientAssertion,
    dpop,
    correlationId,
  }: {
    eserviceId: EServiceId;
    descriptorId: DescriptorId;
    generatedToken: InteropConsumerToken;
    key: FullTokenGenerationStatesConsumerClient;
    clientAssertion: ClientAssertion;
    dpop: DPoPProof | undefined;
    correlationId: CorrelationId;
  }): GeneratedTokenAuditDetails {
    return {
      jwtId: generatedToken.payload.jti,
      correlationId,
      issuedAt: secondsToMilliseconds(generatedToken.payload.iat),
      clientId: clientAssertion.payload.sub,
      organizationId: key.consumerId,
      agreementId: key.agreementId,
      eserviceId,
      descriptorId,
      purposeId: key.GSIPK_purposeId,
      purposeVersionId: unsafeBrandId(key.purposeVersionId),
      algorithm: generatedToken.header.alg,
      keyId: generatedToken.header.kid,
      audience: [generatedToken.payload.aud].flat().join(","),
      subject: generatedToken.payload.sub,
      notBefore: secondsToMilliseconds(generatedToken.payload.nbf),
      expirationTime: secondsToMilliseconds(generatedToken.payload.exp),
      issuer: generatedToken.payload.iss,
      clientAssertion: {
        algorithm: clientAssertion.header.alg,
        audience: [clientAssertion.payload.aud].flat().join(","),
        expirationTime: secondsToMilliseconds(clientAssertion.payload.exp),
        issuedAt: secondsToMilliseconds(clientAssertion.payload.iat),
        issuer: clientAssertion.payload.iss,
        jwtId: clientAssertion.payload.jti,
        keyId: clientAssertion.header.kid,
        subject: clientAssertion.payload.sub,
      },
      ...(dpop
        ? {
            dpop: {
              typ: dpop.header.typ,
              alg: dpop.header.alg,
              jwk: dpop.header.jwk,
              htm: dpop.payload.htm,
              htu: dpop.payload.htu,
              iat: secondsToMilliseconds(dpop.payload.iat),
              jti: dpop.payload.jti,
            },
          }
        : {}),
    };
  }

  private async fallbackToS3(
    messageBody: GeneratedTokenAuditDetails
  ): Promise<void> {
    const date = new Date();
    const ymdDate = formatDateyyyyMMdd(date);
    const hmsTime = formatTimehhmmss(date);

    const fileName = `${ymdDate}_${hmsTime}_${generateId()}.ndjson`;
    const filePath = `token-details/${ymdDate}`;

    try {
      await this.fileManager.storeBytes(
        {
          bucket: this.config.s3Bucket,
          path: filePath,
          name: fileName,
          content: Buffer.from(JSON.stringify(messageBody)),
        },
        this.logger
      );
      this.logger.info("Auditing succeeded through fallback");
    } catch (err) {
      this.logger.error(`Auditing fallback failed: ${err}`);
      throw fallbackAuditFailed(messageBody.clientId);
    }
  }
}
