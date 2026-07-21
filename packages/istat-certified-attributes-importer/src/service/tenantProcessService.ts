/* eslint-disable max-params */
import {
  createZodiosClientEnhancedWithMetadata,
  tenantApi,
  ZodiosClientWithMetadata,
} from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";

import { InteropContext } from "../model/interopContextModel.js";

type MetadataVersion = {
  version: number;
};

export class TenantProcessService {
  private readonly client: ZodiosClientWithMetadata<
    ReturnType<typeof tenantApi.createInternalApiClient>
  >;

  constructor(tenantProcessUrl: string) {
    this.client = createZodiosClientEnhancedWithMetadata(
      tenantApi.createInternalApiClient,
      tenantProcessUrl
    );
  }

  public async internalAssignCertifiedDiscreteAttribute(
    tOrigin: string,
    tRemoteId: string,
    aOrigin: string,
    aExternalId: string,
    discreteValue: number,
    context: InteropContext,
    logger: Logger
  ): Promise<MetadataVersion | undefined> {
    try {
      const response =
        await this.client.internalAssignCertifiedDiscreteAttribute(
          { value: discreteValue },
          {
            params: {
              tOrigin,
              tRemoteId,
              aOrigin,
              aExternalId,
            },
            headers: {
              "X-Correlation-Id": context.correlationId,
              Authorization: `Bearer ${context.bearerToken}`,
            },
          }
        );

      return response.metadata;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `Error on internalAssignDiscreteCertifiedAttribute. Reason: ${message}`
      );
      throw err;
    }
  }

  public async internalUpdateCertifiedDiscreteAttribute(
    tOrigin: string,
    tRemoteId: string,
    aOrigin: string,
    aExternalId: string,
    discreteValue: number,
    context: InteropContext,
    logger: Logger
  ): Promise<MetadataVersion | undefined> {
    try {
      const response =
        await this.client.internalUpdateCertifiedDiscreteAttribute(
          { value: discreteValue },
          {
            params: {
              tOrigin,
              tRemoteId,
              aOrigin,
              aExternalId,
            },
            headers: {
              "X-Correlation-Id": context.correlationId,
              Authorization: `Bearer ${context.bearerToken}`,
            },
          }
        );

      return response.metadata;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `Error on internalUpdateCertifiedDiscreteAttribute. Reason: ${message}`
      );

      throw err;
    }
  }

  public async internalRevokeCertifiedDiscreteAttribute(
    tOrigin: string,
    tRemoteId: string,
    aOrigin: string,
    aExternalId: string,
    context: InteropContext,
    logger: Logger
  ): Promise<MetadataVersion | undefined> {
    try {
      const response =
        await this.client.internalRevokeCertifiedDiscreteAttribute(undefined, {
          params: {
            tOrigin,
            tRemoteId,
            aOrigin,
            aExternalId,
          },
          headers: {
            "X-Correlation-Id": context.correlationId,
            Authorization: `Bearer ${context.bearerToken}`,
            "Content-Type": false,
          },
        });

      return response.metadata;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Error on internalRevokeCertifiedAttribute: ${message}`);
      throw err;
    }
  }
}
