import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  FileManager,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/errors.js";
import { delegationServiceBuilder } from "../services/delegationService.js";

const consumerDelegationRouter = (
  ctx: ZodiosContext,
  {
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
  }: PagoPAInteropBeClients,
  fileManager: FileManager
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const consumerDelegationRouter = ctx.router(
    bffApi.consumerDelegationsApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  const delegationService = delegationServiceBuilder(
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
    fileManager
  );

  consumerDelegationRouter
    .post("/consumers/delegations", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const delegationResource =
          await delegationService.createConsumerDelegation(req.body, ctx);

        return res
          .status(200)
          .send(bffApi.CreatedResource.parse(delegationResource));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating delegation`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumers/delegations/:delegationId/approve", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await delegationService.approveConsumerDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error approving delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumers/delegations/:delegationId/reject", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await delegationService.rejectConsumerDelegation(
          unsafeBrandId(req.params.delegationId),
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error rejecting delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/consumers/delegations/:delegationId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await delegationService.revokeConsumerDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error revoking delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/consumers/delegations/delegators", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const delegators = await delegationService.getConsumerDelegators(
          req.query,
          ctx
        );

        return res.status(200).send(bffApi.DelegationTenants.parse(delegators));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error getting delegators`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/consumers/delegations/delegatorsWithAgreements",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const delegators =
            await delegationService.getConsumerDelegatorsWithAgreements(
              req.query,
              ctx
            );

          return res
            .status(200)
            .send(bffApi.DelegationTenants.parse(delegators));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error getting delegators with active agreements`
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/consumers/delegations/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const eservices = await delegationService.getConsumerDelegatedEservices(
          req.query,
          ctx
        );

        return res.status(200).send(bffApi.CompactEServices.parse(eservices));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error getting consumer delegated eservices`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });

  return consumerDelegationRouter;
};

export default consumerDelegationRouter;
