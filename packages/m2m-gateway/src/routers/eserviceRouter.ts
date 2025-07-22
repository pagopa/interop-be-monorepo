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
import { EserviceService } from "../services/eserviceService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import {
  getEserviceDescriptorErrorMapper,
  downloadEServiceDescriptorInterfaceErrorMapper,
} from "../utils/errorMappers.js";
import { sendDownloadedDocumentAsFormData } from "../utils/fileDownload.js";

const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

const eserviceRouter = (
  ctx: ZodiosContext,
  eserviceService: EserviceService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceRouter = ctx.router(m2mGatewayApi.eservicesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  eserviceRouter
    .get("/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const eservices = await eserviceService.getEServices(req.query, ctx);

        return res.status(200).send(m2mGatewayApi.EServices.parse(eservices));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservices`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eserviceId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const eservice = await eserviceService.getEService(
          unsafeBrandId(req.params.eserviceId),
          ctx
        );

        return res.status(200).send(m2mGatewayApi.EService.parse(eservice));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eserviceId/descriptors", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const descriptors = await eserviceService.getEServiceDescriptors(
          unsafeBrandId(req.params.eserviceId),
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceDescriptors.parse(descriptors));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice ${req.params.eserviceId} descriptors`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const descriptor = await eserviceService.getEServiceDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceDescriptor.parse(descriptor));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEserviceDescriptorErrorMapper,
            ctx,
            `Error retrieving eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId/interface",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
          const file =
            await eserviceService.downloadEServiceDescriptorInterface(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              ctx
            );

          return sendDownloadedDocumentAsFormData(file, res);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            downloadEServiceDescriptorInterfaceErrorMapper,
            ctx,
            `Error retrieving interface for eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eserviceRouter;
};

export default eserviceRouter;
