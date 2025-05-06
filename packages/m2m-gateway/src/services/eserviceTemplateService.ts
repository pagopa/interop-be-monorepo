import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { toM2MEServiceTemplate } from "../api/eserviceTemplateApiConverter.js";

export type EserviceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder({
  eserviceTemplateProcessClient,
}: PagoPAInteropBeClients) {
  return {
    getEServiceTemplateById: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      templateId: string
    ): Promise<m2mGatewayApi.EServiceTemplate> => {
      logger.info(`Retrieving eservice template ${templateId}`);

      const { data } =
        await eserviceTemplateProcessClient.getEServiceTemplateById({
          headers,
          params: { templateId },
        });

      return toM2MEServiceTemplate(data);
    },
  };
}
