import { Request, Response, NextFunction } from "express";
import { config } from "../config/config.js";

export const assertAdminClientFeatureEnabled = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!config.featureFlagAdminClient) {
    res.status(403).send({
      title: "Feature disabled",
      detail: "The admin client feature is currently disabled",
      code: "FEATURE_DISABLED",
    });
    return;
  }
  next();
};
