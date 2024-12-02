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
} from "pagopa-interop-commons";
import { makeApiProblem } from "../model/domain/errors.js";
import { delegationToApiDelegation } from "../model/domain/apiConverter.js";
import { delegationConsumerServiceBuilder } from "../services/delegationConsumerService.js";
import { ReadModelService } from "../services/readModelService.js";
import { createConsumerDelegationErrorMapper } from "../utilities/errorMappers.js";

const { ADMIN_ROLE } = userRoles;

const delegationConsumerRouter = (
  ctx: ZodiosContext,
  eventStore: DB,
  readModelService: ReadModelService
): ZodiosRouter<typeof delegationApi.consumerApi.api, ExpressContext> => {
  const delegationConsumerRouter = ctx.router(delegationApi.consumerApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationConsumerService = delegationConsumerServiceBuilder(
    eventStore,
    readModelService
  );

  delegationConsumerRouter.post(
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
  );

  return delegationConsumerRouter;
};

export default delegationConsumerRouter;