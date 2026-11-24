/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { assertFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import { EServiceId } from "pagopa-interop-models";

import {
  toBffMonitoringArchiving,
  toBffProducerDashboardConsumer,
} from "../api/catalogApiConverter.js";
import {
  toBffProducerDashboardSaturation,
  toBffProducerEServiceMonitoringConsumerPurposes,
  toBffProducerEServiceMonitoringSaturation,
} from "../api/purposeApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { config } from "../config/config.js";
import { BffAppContext } from "../utilities/context.js";

export function producerDashboardServiceBuilder({
  purposeProcessClient,
  catalogProcessClient,
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
    async getProducerEServiceMonitoringArchiving(
      eserviceId: EServiceId,
      queries: { offset: number; limit: number },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.MonitoringArchiving> {
      assertFeatureFlagEnabled(config, "featureFlagProducerDashboard");

      logger.info(
        `Retrieving archiving monitoring for e-service ${eserviceId}, offset ${queries.offset}, limit ${queries.limit}`
      );

      const result =
        await catalogProcessClient.getProducerEServiceMonitoringArchiving({
          params: { eserviceId },
          queries,
          headers,
        });

      return toBffMonitoringArchiving(result);
    },
    async getProducerEServiceMonitoringSaturation(
      eserviceId: string,
      descriptorId: string,
      queries: {
        offset: number;
        limit: number;
        q?: string | undefined;
        sortBy?: bffApi.SaturationSortBy | undefined;
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceMonitoringSaturation> {
      logger.info(
        `Retrieving e-service monitoring saturation for e-service ${eserviceId}, descriptor ${descriptorId}, q ${queries.q}, sortBy ${queries.sortBy}, offset ${queries.offset}, limit ${queries.limit}`
      );

      const result =
        await purposeProcessClient.getProducerEServiceMonitoringSaturation({
          params: { eserviceId, descriptorId },
          queries,
          headers,
        });

      return toBffProducerEServiceMonitoringSaturation(result);
    },
    async getProducerDashboardConsumer(
      consumerId: string,
      queries: {
        offset: number;
        limit: number;
        q?: string | undefined;
        sortBy?: bffApi.ConsumerEServicesSortBy | undefined;
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerDashboardConsumer> {
      assertFeatureFlagEnabled(config, "featureFlagProducerDashboard");

      logger.info(
        `Retrieving producer dashboard consumer ${consumerId} for q ${queries.q}, sortBy ${queries.sortBy}, offset ${queries.offset}, limit ${queries.limit}`
      );

      const result = await catalogProcessClient.getProducerDashboardConsumer({
        params: { consumerId },
        queries,
        headers,
      });

      return toBffProducerDashboardConsumer(result);
    },
    async getProducerEServiceMonitoringConsumerPurposes(
      eserviceId: string,
      descriptorId: string,
      consumerId: string,
      queries: {
        offset: number;
        limit: number;
        q?: string | undefined;
        sortBy?: bffApi.DateNameSortBy | undefined;
        states?: bffApi.PurposeVersionState[] | undefined;
        includeArchived?: boolean | undefined;
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceMonitoringConsumerPurposes> {
      logger.info(
        `Retrieving purposes of consumer ${consumerId} for e-service ${eserviceId}, descriptor ${descriptorId}, q ${queries.q}, sortBy ${queries.sortBy}, states ${queries.states}, includeArchived ${queries.includeArchived}, offset ${queries.offset}, limit ${queries.limit}`
      );

      const result =
        await purposeProcessClient.getProducerEServiceMonitoringConsumerPurposes(
          {
            params: { eserviceId, descriptorId, consumerId },
            queries,
            headers,
          }
        );

      return toBffProducerEServiceMonitoringConsumerPurposes(result);
    },
  };
}

export type ProducerDashboardService = ReturnType<
  typeof producerDashboardServiceBuilder
>;
