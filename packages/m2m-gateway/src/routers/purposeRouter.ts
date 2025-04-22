import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { purposeServiceBuilder } from "../services/purposeService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const purposeRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE } = authRole;

  const purposeRouter = ctx.router(m2mGatewayApi.purposesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const purposeService = purposeServiceBuilder(clients);
  void purposeService;

  purposeRouter
    .get("/purposes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const purposes = await purposeService.getPurposes(ctx, req.query);

        return res.status(200).send(m2mGatewayApi.Purposes.parse(purposes));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving purposes"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposes/:purposeId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose with id ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposes/:purposeId/versions", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose ${req.params.purposeId} versions`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposes/:purposeId/versions/:versionId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose ${req.params.purposeId} version ${req.params.versionId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating purpose`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/versions", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating purpose ${req.params.purposeId} version`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/activate", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error activating purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/approve", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error approving purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/archive", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error archiving purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/suspend", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error suspending purpose ${req.params.purposeId} version`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/unsuspend", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error unsuspending purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return purposeRouter;
};

export default purposeRouter;
