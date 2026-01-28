import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { UserId, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { UserService } from "../services/userService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import {
  getUserErrorMapper,
  getSelfcareErrorMapper,
} from "../utils/errorMappers.js";

const userRouter = (
  ctx: ZodiosContext,
  userService: UserService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ADMIN_ROLE } = authRole;
  const userRouter = ctx.router(m2mGatewayApiV3.usersApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  userRouter
    .get("/users", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        // Enforce m2m-admin role only
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const users = await userService.getUsers(req.query, ctx);

        return res.status(200).send(m2mGatewayApiV3.Users.parse(users));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx,
          "Error retrieving users"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/users/:userId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        // Enforce m2m-admin role only
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const user = await userService.getUserById(
          unsafeBrandId<UserId>(req.params.userId),
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.User.parse(user));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getUserErrorMapper,
          ctx,
          "Error retrieving user"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return userRouter;
};

export default userRouter;
