/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";

import { toBffProducerDashboardSaturation } from "../api/purposeApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";

export function producerDashboardServiceBuilder({
  purposeProcessClient,
}: PagoPAInteropBeClients) {
  return {
    async getProducerDashboardSaturation(
      queries: {
        offset: number;
        limit: number;
        q?: string | undefined;
        sortBy?: bffApi.SaturationSortBy | undefined;
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerDashboardSaturation> {
      logger.info(
        `Retrieving producer dashboard saturation for q ${queries.q}, sortBy ${queries.sortBy}, offset ${queries.offset}, limit ${queries.limit}`
      );

      const result = await purposeProcessClient.getProducerDashboardSaturation({
        queries,
        headers,
      });

      return toBffProducerDashboardSaturation(result);
    },
  };
}

export type ProducerDashboardService = ReturnType<
  typeof producerDashboardServiceBuilder
>;
