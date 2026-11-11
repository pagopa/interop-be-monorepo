import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { constants } from "http2";
import {
  ExpressContext,
  fromAppContext,
  isUiAuthData,
} from "pagopa-interop-commons";
import { unauthorizedError } from "pagopa-interop-models";

import type { UserFacingLanguage } from "../model/types.js";

import { makeApiProblem } from "../model/errors.js";

export function uiAuthDataValidationMiddleware(): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    // We assume that:
    // - contextMiddleware already set basic ctx info such as correlationId
    // - authenticationMiddleware already set authData in ctx

    const ctx = fromAppContext(req.ctx);

    if (!isUiAuthData(ctx.authData)) {
      const errorRes = makeApiProblem(
        unauthorizedError(
          `Invalid role ${ctx.authData.systemRole} for this operation`
        ),
        () => constants.HTTP_STATUS_FORBIDDEN,
        ctx
      );
      return res.status(errorRes.status).send(errorRes);
    }

    return next();
  };
}

export function getLocaleFromAcceptLanguageHeader(
  acceptLanguageHeader: string | undefined
): UserFacingLanguage | undefined {
  if (!acceptLanguageHeader) {
    return undefined;
  }

  const acceptedLanguages = acceptLanguageHeader
    .split(",")
    .map((entry, index) => {
      const [languageRange, ...parameters] = entry.split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().toLowerCase().startsWith("q=")
      );
      const qualityValue = qualityParameter?.trim().slice(2);
      const quality =
        qualityValue === undefined
          ? 1
          : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(qualityValue)
            ? Number(qualityValue)
            : 0;
      const language = languageRange.trim().split("-")[0].toLowerCase();

      return { language, quality, index };
    })
    .filter(
      ({ language, quality }) =>
        quality > 0 && language !== "" && language !== "*"
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  const preferredLanguage = acceptedLanguages[0]?.language;

  if (preferredLanguage === "it") {
    return "it";
  }

  if (preferredLanguage) {
    return "en";
  }

  return undefined;
}

export function endpointContextMiddleware(): ZodiosRouterContextRequestHandler<ExpressContext> {
  return (req, _res, next) => {
    Object.defineProperty(req.ctx, "endpoint", {
      configurable: true,
      enumerable: true,
      get: () =>
        req.route ? `${req.method.toUpperCase()} ${req.route.path}` : undefined,
    });
    Object.defineProperty(req.ctx, "locale", {
      configurable: true,
      enumerable: true,
      get: () =>
        getLocaleFromAcceptLanguageHeader(req.headers["accept-language"]),
    });
    return next();
  };
}
