/* eslint-disable max-params */
import {
  createZodiosClientEnhancedWithMetadata,
  tenantApi,
  ZodiosClientWithMetadata,
} from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import { InteropContext } from "../model/interopContextModel.js";

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

  public async internalAssignCertifiedAttribute(
    tenantOrigin: string,
    tenantExternalId: string,
    attributeOrigin: string,
    attributeExternalId: string,
    context: InteropContext,
    logger: Logger
  ): Promise<number | undefined> {
    try {
      const response = await this.client.internalAssignCertifiedAttribute(
        undefined,
        {
          params: {
            tOrigin: tenantOrigin,
            tExternalId: tenantExternalId,
            aOrigin: attributeOrigin,
            aExternalId: attributeExternalId,
          },
          headers: {
            "X-Correlation-Id": context.correlationId,
            Authorization: `Bearer ${context.bearerToken}`,
            "Content-Type": false,
          },
        }
      );

      return response.metadata?.version;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `Error on internalAssignCertifiedAttribute. Reason: ${message}`
      );
      throw Error(
        `Unexpected response from internalAssignCertifiedAttribute. Reason: ${message}`
      );
    }
  }

  public async internalRevokeCertifiedAttribute(
    tenantOrigin: string,
    tenantExternalId: string,
    attributeOrigin: string,
    attributeExternalId: string,
    context: InteropContext,
    logger: Logger
  ): Promise<number | undefined> {
    try {
      const response = await this.client.internalRevokeCertifiedAttribute(
        undefined,
        {
          params: {
            tOrigin: tenantOrigin,
            tExternalId: tenantExternalId,
            aOrigin: attributeOrigin,
            aExternalId: attributeExternalId,
          },
          headers: {
            "X-Correlation-Id": context.correlationId,
            Authorization: `Bearer ${context.bearerToken}`,
            "Content-Type": false,
          },
        }
      );

      return response.metadata?.version;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `Error on internalRevokeCertifiedAttribute. Reason: ${message}`
      );
      throw Error(
        `Unexpected response from internalRevokeCertifiedAttribute. Reason: ${message}`
      );
    }
  }
}
