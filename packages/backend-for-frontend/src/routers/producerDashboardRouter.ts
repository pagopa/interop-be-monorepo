import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";

import { makeApiProblem } from "../model/errors.js";
import { ProducerDashboardService } from "../services/producerDashboardService.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  getProducerDashboardConsumerErrorMapper,
  getProducerDashboardSaturationErrorMapper,
  getProducerEServiceMonitoringArchivingErrorMapper,
} from "../utilities/errorMappers.js";

const producerDashboardRouter = (
  ctx: ZodiosContext,
  producerDashboardService: ProducerDashboardService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerDashboardRouter = ctx.router(bffApi.producersDashboardApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  producerDashboardRouter.get(
    "/producers/dashboard/saturation",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await producerDashboardService.getProducerDashboardSaturation(
            req.query,
            ctx
          );

        return res
          .status(200)
          .send(bffApi.ProducerDashboardSaturation.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerDashboardSaturationErrorMapper,
          ctx,
          `Error retrieving producer dashboard saturation for q ${req.query.q}, sortBy ${req.query.sortBy}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  producerDashboardRouter.get(
    "/producers/eservices/:eserviceId/monitoring/archiving",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await producerDashboardService.getProducerEServiceMonitoringArchiving(
            unsafeBrandId(req.params.eserviceId),
            req.query,
            ctx
          );

        return res.status(200).send(bffApi.MonitoringArchiving.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerEServiceMonitoringArchivingErrorMapper,
          ctx,
          `Error retrieving archiving monitoring for e-service ${req.params.eserviceId}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  producerDashboardRouter.get(
    "/producers/eservices/:eserviceId/descriptors/:descriptorId/monitoring/saturation",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await producerDashboardService.getProducerEServiceMonitoringSaturation(
            req.params.eserviceId,
            req.params.descriptorId,
            req.query,
            ctx
          );

        return res
          .status(200)
          .send(bffApi.ProducerEServiceMonitoringSaturation.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving e-service monitoring saturation for e-service ${req.params.eserviceId}, descriptor ${req.params.descriptorId}, q ${req.query.q}, sortBy ${req.query.sortBy}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  producerDashboardRouter.get(
    "/producers/dashboard/consumers/:consumerId",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await producerDashboardService.getProducerDashboardConsumer(
            req.params.consumerId,
            req.query,
            ctx
          );

        return res
          .status(200)
          .send(bffApi.ProducerDashboardConsumer.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerDashboardConsumerErrorMapper,
          ctx,
          `Error retrieving producer dashboard consumer ${req.params.consumerId} for q ${req.query.q}, sortBy ${req.query.sortBy}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  producerDashboardRouter.get(
    "/producers/eservices/:eserviceId/descriptors/:descriptorId/monitoring/consumers/:consumerId/purposes",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await producerDashboardService.getProducerEServiceMonitoringConsumerPurposes(
            req.params.eserviceId,
            req.params.descriptorId,
            req.params.consumerId,
            req.query,
            ctx
          );

        return res
          .status(200)
          .send(
            bffApi.ProducerEServiceMonitoringConsumerPurposes.parse(result)
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purposes of consumer ${req.params.consumerId} for e-service ${req.params.eserviceId}, descriptor ${req.params.descriptorId}, q ${req.query.q}, sortBy ${req.query.sortBy}, states ${req.query.states}, includeArchived ${req.query.includeArchived}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  return producerDashboardRouter;
};

export default producerDashboardRouter;
