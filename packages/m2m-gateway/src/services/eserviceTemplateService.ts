import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { toM2MGatewayEServiceTemplate } from "../api/eserviceTemplateApiConverter.js";

export type EserviceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  clients: PagoPAInteropBeClients
) {
  return {
    async getEServiceTemplateById(
      templateId: string,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceTemplate> {
      logger.info(`Retrieving eservice template with id${templateId}`);

      const { data } =
        await clients.eserviceTemplateProcessClient.getEServiceTemplateById({
          headers,
          params: { templateId },
        });

      return toM2MGatewayEServiceTemplate(data);
    },
  };
}
