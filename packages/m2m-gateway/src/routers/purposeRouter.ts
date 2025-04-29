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
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PurposeService } from "../services/purposeService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const purposeRouter = (
  ctx: ZodiosContext,
  purposeService: PurposeService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE } = authRole;

  const purposeRouter = ctx.router(m2mGatewayApi.purposesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

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
        validateAuthorization(ctx, [M2M_ROLE]);

        const purpose = await purposeService.getPurpose(
          ctx,
          unsafeBrandId(req.params.purposeId)
        );

        return res.status(200).send(m2mGatewayApi.Purpose.parse(purpose));
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
        validateAuthorization(ctx, [M2M_ROLE]);

        const versions = await purposeService.getPurposeVersions(
          ctx,
          unsafeBrandId(req.params.purposeId),
          req.query
        );

        return res
          .status(200)
          .send(m2mGatewayApi.PurposeVersions.parse(versions));
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
        validateAuthorization(ctx, [M2M_ROLE]);

        const version = await purposeService.getPurposeVersion(
          ctx,
          unsafeBrandId(req.params.purposeId),
          unsafeBrandId(req.params.versionId)
        );

        return res
          .status(200)
          .send(m2mGatewayApi.PurposeVersion.parse(version));
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
        validateAuthorization(ctx, [M2M_ROLE]);

        const purpose = await purposeService.createPurpose(ctx, req.body);

        return res.status(201).send(m2mGatewayApi.Purpose.parse(purpose));
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
        validateAuthorization(ctx, [M2M_ROLE]);

        const version = await purposeService.createPurposeVersion(
          ctx,
          unsafeBrandId(req.params.purposeId),
          req.body
        );

        return res
          .status(201)
          .send(m2mGatewayApi.PurposeVersion.parse(version));
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
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          await purposeService.activatePurposeVersion(
            ctx,
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId)
          );

          return res.status(204);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error activating purpose ${req.params.purposeId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
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
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          await purposeService.archivePurposeVersion(
            ctx,
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId)
          );

          return res.status(204);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error archiving purpose ${req.params.purposeId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          await purposeService.suspendPurposeVersion(
            ctx,
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId)
          );

          return res.status(204);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error suspending purpose ${req.params.purposeId} version`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
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
