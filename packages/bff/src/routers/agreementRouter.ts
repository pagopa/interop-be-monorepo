import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { makeApiProblem } from "../model/domain/errors.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  activateAgreementErrorMapper,
  emptyErrorMapper,
  getAgreementByIdErrorMapper,
  getAgreementsErrorMapper,
} from "../utilities/errorMappers.js";
import { agreementServiceBuilder } from "../services/agreementService.js";

const agreementRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(bffApi.agreementsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const agreementService = agreementServiceBuilder(clients);

  agreementRouter
    .get("/agreements", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const {
          consumersIds,
          eservicesIds,
          limit,
          offset,
          producersIds,
          showOnlyUpgradeable,
          states,
        } = req.query;

        const result = await agreementService.getAgreements(
          {
            offset,
            limit,
            producersIds,
            eservicesIds,
            consumersIds,
            states,
            showOnlyUpgradeable,
          },
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAgreementsErrorMapper,
          ctx.logger,
          "Error retrieving agreements"
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/agreements", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.createAgreement(req.body, ctx);
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating agreement for EService ${req.body.eserviceId} and Descriptor ${req.body.descriptorId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/producers/agreements/eservices", async (_req, res) =>
      res.status(501).send()
    )
    .get("/consumers/agreements/eservices", async (_req, res) =>
      res.status(501).send()
    )
    .get("/agreements/filter/producers", async (_req, res) =>
      res.status(501).send()
    )
    .get("/agreements/filter/consumers", async (_req, res) =>
      res.status(501).send()
    )

    .get("/agreements/:agreementId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.getAgreementById(
          req.params.agreementId,
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAgreementByIdErrorMapper,
          ctx.logger,
          `Error retrieving agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .delete("/agreements/:agreementId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await agreementService.deleteAgreement(req.params.agreementId, ctx);
        return res.status(204).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error deleting agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/agreements/:agreementId/activate", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.activateAgreement(
          req.params.agreementId,
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activateAgreementErrorMapper,
          ctx.logger,
          `Error activating agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/agreements/:agreementId/clone", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.cloneAgreement(
          req.params.agreementId,
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error cloning agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/agreements/:agreementId/consumer-documents", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/agreements/:agreementId/consumer-documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/agreements/:agreementId/consumer-documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .get("/agreements/:agreementId/contract", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/submit", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.submitAgreement(
          req.params.agreementId,
          req.body,
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error submitting agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/agreements/:agreementId/suspend", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.suspendAgreement(
          req.params.agreementId,
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error suspending agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/agreements/:agreementId/reject", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.rejectAgreement(
          req.params.agreementId,
          req.body,
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error rejecting agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/agreements/:agreementId/archive", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await agreementService.archiveAgreement(req.params.agreementId, ctx);
        return res.status(204).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error archiving agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/agreements/:agreementId/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.updateAgreement(
          req.params.agreementId,
          req.body,
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error updating agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/agreements/:agreementId/upgrade", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.upgradeAgreement(
          req.params.agreementId,
          ctx
        );
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error upgrading agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    });

  return agreementRouter;
};

export default agreementRouter;
