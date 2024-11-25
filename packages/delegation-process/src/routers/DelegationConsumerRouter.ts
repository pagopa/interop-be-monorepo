import { ZodiosRouter } from "@zodios/express";
import { delegationApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  authorizationMiddleware,
  userRoles,
  fromAppContext,
  DB,
  PDFGenerator,
  FileManager,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/domain/errors.js";
import { delegationToApiDelegation } from "../model/domain/apiConverter.js";
import { delegationConsumerServiceBuilder } from "../services/delegationConsumerService.js";
import { ReadModelService } from "../services/readModelService.js";
import {
  approveDelegationErrorMapper,
  createConsumerDelegationErrorMapper,
  rejectDelegationErrorMapper,
} from "../utilities/errorMappers.js";

const { ADMIN_ROLE } = userRoles;

const delegationConsumerRouter = (
  ctx: ZodiosContext,
  eventStore: DB,
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager
): ZodiosRouter<typeof delegationApi.consumerApi.api, ExpressContext> => {
  const delegationConsumerRouter = ctx.router(delegationApi.consumerApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationConsumerService = delegationConsumerServiceBuilder(
    eventStore,
    readModelService,
    pdfGenerator,
    fileManager
  );

  delegationConsumerRouter
    .post(
      "/consumer/delegations",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const delegation =
            await delegationConsumerService.createConsumerDelegation(
              req.body,
              ctx
            );
          return res
            .status(200)
            .json(
              delegationApi.Delegation.parse(
                delegationToApiDelegation(delegation)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createConsumerDelegationErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/consumer/delegations/:delegationId/approve",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await delegationConsumerService.approveConsumerDelegation(
            unsafeBrandId(req.params.delegationId),
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            approveDelegationErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/consumer/delegations/:delegationId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { rejectionReason } = req.body;

        try {
          await delegationConsumerService.rejectConsumerDelegation(
            unsafeBrandId(req.params.delegationId),
            rejectionReason,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            rejectDelegationErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return delegationConsumerRouter;
};

export default delegationConsumerRouter;
