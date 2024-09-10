/* eslint-disable max-params */
import axios from "axios";
import { Logger } from "pagopa-interop-commons";
import { InteropContext } from "../model/interopContextModel.js";

export class TenantProcessService {
  constructor(private tenantProcessUrl: string) {}

  public async internalAssignCertifiedAttribute(
    tenantOrigin: string,
    tenantExternalId: string,
    attributeOrigin: string,
    attributeExternalId: string,
    context: InteropContext,
    logger: Logger
  ): Promise<void> {
    const { data } = await axios
      .post<void>(
        `${this.tenantProcessUrl}/internal/origin/${tenantOrigin}/externalId/${tenantExternalId}/attributes/origin/${attributeOrigin}/externalId/${attributeExternalId}`,
        undefined,
        {
          headers: {
            "X-Correlation-Id": context.correlationId,
            Authorization: `Bearer ${context.bearerToken}`,
            "Content-Type": false,
          },
        }
      )
      .catch((err) => {
        logger.error(
          `Error on internalAssignCertifiedAttribute. Reason: ${err.message}`
        );
        throw Error(
          `Unexpected response from internalAssignCertifiedAttribute. Reason: ${err.message}`
        );
      });
    return data;
  }

  public async internalRevokeCertifiedAttribute(
    tenantOrigin: string,
    tenantExternalId: string,
    attributeOrigin: string,
    attributeExternalId: string,
    context: InteropContext,
    logger: Logger
  ): Promise<void> {
    const { data } = await axios
      .delete<void>(
        `${this.tenantProcessUrl}/internal/origin/${tenantOrigin}/externalId/${tenantExternalId}/attributes/origin/${attributeOrigin}/externalId/${attributeExternalId}`,
        {
          headers: {
            "X-Correlation-Id": context.correlationId,
            Authorization: `Bearer ${context.bearerToken}`,
            "Content-Type": "application/json",
          },
        }
      )
      .catch((err) => {
        logger.error(
          `Error on internalRevokeCertifiedAttribute. Reason: ${err.message}`
        );
        throw Error(
          `Unexpected response from internalRevokeCertifiedAttribute. Reason: ${err.message}`
        );
      });
    return data;
  }
}
