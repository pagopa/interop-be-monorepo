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
import {
  getPurposeVersionErrorMapper,
  suspendPurposeErrorMapper,
  archivePurposeErrorMapper,
  approvePurposeErrorMapper,
  activatePurposeErrorMapper,
  unsuspendPurposeErrorMapper,
  getPurposeVersionDocumentErrorMapper,
} from "../utils/errorMappers.js";
import { sendDownloadedDocumentAsFormData } from "../utils/fileDownload.js";

const purposeRouter = (
  ctx: ZodiosContext,
  purposeService: PurposeService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE, M2M_ADMIN_ROLE } = authRole;

  const purposeRouter = ctx.router(m2mGatewayApi.purposesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  purposeRouter
    .get("/purposes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const purposes = await purposeService.getPurposes(req.query, ctx);

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
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const purpose = await purposeService.getPurpose(
          unsafeBrandId(req.params.purposeId),
          ctx
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
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const versions = await purposeService.getPurposeVersions(
          unsafeBrandId(req.params.purposeId),
          req.query,
          ctx
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
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const version = await purposeService.getPurposeVersion(
          unsafeBrandId(req.params.purposeId),
          unsafeBrandId(req.params.versionId),
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.PurposeVersion.parse(version));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposeVersionErrorMapper,
          ctx,
          `Error retrieving purpose ${req.params.purposeId} version ${req.params.versionId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purpose = await purposeService.createPurpose(req.body, ctx);

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
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const version = await purposeService.createPurposeVersion(
          unsafeBrandId(req.params.purposeId),
          req.body,
          ctx
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
    .post("/purposes/:purposeId/activate", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purpose = await purposeService.activateDraftPurpose(
          unsafeBrandId(req.params.purposeId),
          ctx
        );

        return res.status(200).send(m2mGatewayApi.Purpose.parse(purpose));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activatePurposeErrorMapper,
          ctx,
          `Error activating purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/approve", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purpose = await purposeService.approvePurpose(
          unsafeBrandId(req.params.purposeId),
          ctx
        );

        return res.status(200).send(m2mGatewayApi.Purpose.parse(purpose));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          approvePurposeErrorMapper,
          ctx,
          `Error approving purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/archive", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purpose = await purposeService.archivePurpose(
          unsafeBrandId(req.params.purposeId),
          ctx
        );

        return res.status(200).send(m2mGatewayApi.Purpose.parse(purpose));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          archivePurposeErrorMapper,
          ctx,
          `Error archiving purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/suspend", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purpose = await purposeService.suspendPurpose(
          unsafeBrandId(req.params.purposeId),
          ctx
        );

        return res.status(200).send(m2mGatewayApi.Purpose.parse(purpose));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          suspendPurposeErrorMapper,
          ctx,
          `Error suspending purpose ${req.params.purposeId} version`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:purposeId/unsuspend", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purpose = await purposeService.unsuspendPurpose(
          unsafeBrandId(req.params.purposeId),
          ctx
        );

        return res.status(200).send(m2mGatewayApi.Purpose.parse(purpose));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          unsuspendPurposeErrorMapper,
          ctx,
          `Error unsuspending purpose ${req.params.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/purposes/:purposeId/versions/:versionId/document",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const document = await purposeService.getPurposeVersionDocument(
            unsafeBrandId(req.params.purposeId),
            unsafeBrandId(req.params.versionId),
            ctx
          );

          return sendDownloadedDocumentAsFormData(document, res);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getPurposeVersionDocumentErrorMapper,
            ctx,
            `Error retrieving document for purpose ${req.params.purposeId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return purposeRouter;
};

export default purposeRouter;
