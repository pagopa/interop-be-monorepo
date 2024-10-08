import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { delegationApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ReadModelRepository,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import { delegationProducerServiceBuilder } from "../services/delegationProducerService.js";
import { delegationToApiDelegation } from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { getDelegationByIdErrorMapper } from "../utilites/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const delegationProducerRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(delegationApi.producerApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationProducerService =
    delegationProducerServiceBuilder(readModelService);

  delegationRouter
    .get("/producer/delegations/:delegationId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { delegationId } = req.params;

      try {
        const delegation = await delegationProducerService.getDelegationById(
          unsafeBrandId(delegationId)
        );

        return res
          .status(200)
          .send(
            delegationApi.Delegation.parse(
              delegationToApiDelegation(delegation)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationByIdErrorMapper,
          ctx.logger
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producer/delegations", async (_req, res) => res.status(501).send())
    .post("/producer/delegations", async (_req, res) => res.status(501).send())
    .post("/producer/delegations/:delegationId/approve", async (_req, res) =>
      res.status(501).send()
    )
    .post("/producer/delegations/:delegationId/reject", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/producer/delegations/:delegationId", async (_req, res) =>
      res.status(501).send()
    );

  return delegationRouter;
};

export default delegationProducerRouter;
