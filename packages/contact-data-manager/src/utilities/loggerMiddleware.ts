import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { ExpressContext, fromAppContext } from "pagopa-interop-commons";

export const contactRequestLogger: ZodiosRouterContextRequestHandler<
  ExpressContext
> = (req, res, next) => {
  const { logger } = fromAppContext(req.ctx);
  res.on("finish", () => {
    logger.info(`Contact request completed with status ${res.statusCode}`);
  });
  next();
};
