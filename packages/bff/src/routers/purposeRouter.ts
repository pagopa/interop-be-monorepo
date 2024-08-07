import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  initFileManager,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { bffApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { purposeServiceBuilder } from "../services/purposeService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  emptyErrorMapper,
  clonePurposeErrorMapper,
  getPurposesErrorMapper,
  reversePurposeUpdateErrorMapper,
} from "../utilities/errorMappers.js";
import { fromBffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";

const purposeRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeRouter = ctx.router(bffApi.purposesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const purposeService = purposeServiceBuilder(
    clients.purposeProcessClient,
    clients.catalogProcessClient,
    clients.tenantProcessClient,
    clients.agreementProcessClient,
    clients.authorizationClient,
    initFileManager(config)
  );

  purposeRouter
    .post("/reverse/purposes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeService.createPurposeForReceiveEservice(
          req.body,
          ctx
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating Purpose with eService ${req.body.eserviceId} and consumer ${req.body.consumerId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/reverse/purposes/:purposeId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeService.reversePurposeUpdate(
          unsafeBrandId(req.params.purposeId),
          req.body,
          ctx
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          reversePurposeUpdateErrorMapper,
          ctx.logger,
          `Error updating reverse Purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/purposes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeService.createPurpose(req.body, ctx);

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating Purpose with eService ${req.body.eserviceId} and consumer ${req.body.consumerId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/producer/purposes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeService.getProducerPurposes(
          {
            name: req.query.q,
            eservicesIds: req.query.eservicesIds,
            consumersIds: req.query.consumersIds,
            producersIds: req.query.producersIds,
            states: req.query.states,
          },
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposesErrorMapper,
          ctx.logger,
          `Error retrieving Purposes for name ${req.query.q}, EServices ${req.query.eservicesIds}, Consumers ${req.query.consumersIds} offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/consumer/purposes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeService.getConsumerPurposes(
          {
            name: req.query.q,
            eservicesIds: req.query.eservicesIds,
            consumersIds: req.query.consumersIds,
            producersIds: req.query.producersIds,
            states: req.query.states,
          },
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposesErrorMapper,
          ctx.logger,
          `Error retrieving Purposes for name ${req.query.q}, EServices ${req.query.eservicesIds}, Consumers ${req.query.consumersIds} offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/purposes/:purposeId/clone", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeService.clonePurpose(
          unsafeBrandId(req.params.purposeId),
          req.body,
          ctx
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clonePurposeErrorMapper,
          ctx.logger,
          `Error cloning purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/purposes/:purposeId/versions", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeService.createPurposeVersion(
          unsafeBrandId(req.params.purposeId),
          req.body,
          ctx
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating version for purpose ${req.params.purposeId} with dailyCalls ${req.body.dailyCalls}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const result = await purposeService.getRiskAnalysisDocument(
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId),
            unsafeBrandId(req.params.documentId),
            ctx
          );

          return res.status(200).json(Buffer.from(result)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error downloading risk analysis document ${req.params.documentId} from purpose ${req.params.purposeId} with version ${req.params.versionId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/reject",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          await purposeService.rejectPurposeVersion(
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId),
            req.body,
            ctx
          );

          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error rejecting version ${req.params.versionId} of purpose ${req.params.purposeId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const result = await purposeService.archivePurposeVersion(
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId),
            ctx
          );

          return res.status(200).json(result).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error archiving purpose ${req.params.purposeId} with version ${req.params.versionId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const result = await purposeService.suspendPurposeVersion(
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId),
            ctx
          );

          return res.status(200).json(result).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error suspending Version ${req.params.versionId} of Purpose ${req.params.purposeId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const result = await purposeService.activatePurposeVersion(
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId),
            ctx
          );

          return res.status(200).json(result).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error activating Version ${req.params.versionId} of Purpose ${req.params.purposeId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get("/purposes/:purposeId", async (_req, res) => res.status(501).send())
    .delete("/purposes/:purposeId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await purposeService.deletePurpose(
          unsafeBrandId(req.params.purposeId),
          ctx
        );

        return res.status(204).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error deleting purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/purposes/:purposeId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeService.updatePurpose(
          unsafeBrandId(req.params.purposeId),
          req.body,
          ctx
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error updating Purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete("/purposes/:purposeId/versions/:versionId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await purposeService.deletePurposeVersion(
          unsafeBrandId(req.params.purposeId),
          unsafeBrandId(req.params.versionId),
          ctx
        );

        return res.status(204).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error deleting purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/purposes/riskAnalysis/latest", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      async (_req, res) => res.status(501).send()
    );

  return purposeRouter;
};

export default purposeRouter;
