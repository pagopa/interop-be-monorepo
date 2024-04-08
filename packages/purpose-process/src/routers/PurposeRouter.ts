import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const purposeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeRouter = ctx.router(api.api);
  const { ADMIN_ROLE } = userRoles;
  purposeRouter.get("/purposes", authorizationMiddleware([ADMIN_ROLE]));

  return purposeRouter;
};
export default purposeRouter;
