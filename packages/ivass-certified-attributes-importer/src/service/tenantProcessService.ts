/* eslint-disable max-params */
import { tenantApi } from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import { InteropContext } from "../model/interopContextModel.js";

export class TenantProcessService {
  private readonly client: ReturnType<typeof tenantApi.createInternalApiClient>;

  constructor(tenantProcessUrl: string) {
    this.client = tenantApi.createInternalApiClient(tenantProcessUrl);
  }

  public async internalAssignCertifiedAttribute(
    tenantOrigin: string,
    tenantExternalId: string,
    attributeOrigin: string,
    attributeExternalId: string,
    context: InteropContext,
    logger: Logger
  ): Promise<void> {
    return await this.client
      .internalAssignCertifiedAttribute(undefined, {
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
      })
      .catch((err) => {
        logger.error(
          `Error on internalAssignCertifiedAttribute. Reason: ${err.message}`
        );
        throw Error(
          `Unexpected response from internalAssignCertifiedAttribute. Reason: ${err.message}`
        );
      });
  }

  public async internalRevokeCertifiedAttribute(
    tenantOrigin: string,
    tenantExternalId: string,
    attributeOrigin: string,
    attributeExternalId: string,
    context: InteropContext,
    logger: Logger
  ): Promise<void> {
    return await this.client
      .internalRevokeCertifiedAttribute(undefined, {
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
      })
      .catch((err) => {
        logger.error(
          `Error on internalRevokeCertifiedAttribute. Reason: ${err.message}`
        );
        throw Error(
          `Unexpected response from internalRevokeCertifiedAttribute. Reason: ${err.message}`
        );
      });
  }
}
