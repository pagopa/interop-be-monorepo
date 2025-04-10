import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { agreementServiceBuilder } from "../services/agreementService.js";

const agreementRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(m2mGatewayApi.agreementsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const agreementService = agreementServiceBuilder(clients);
  void agreementService;

  agreementRouter
    .get("/agreements", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving agreements"
        );
        return res.status(errorRes.status).send();
      }
    })
    .get("/agreements/:agreementId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error getting agreement by id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/agreements", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating agreement`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/agreements/:agreementId/approve", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error approving agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/agreements/:agreementId/reject", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error rejecting agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/agreements/:agreementId/submit", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error submitting agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/agreements/:agreementId/suspend", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error suspending agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/agreements/:agreementId/unsuspend", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error unsuspending agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/agreements/:agreementId/upgrade", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error upgrading agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send();
      }
    });

  return agreementRouter;
};

export default agreementRouter;
