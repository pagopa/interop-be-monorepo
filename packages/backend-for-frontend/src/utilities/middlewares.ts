import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { constants } from "http2";
import {
  ExpressContext,
  fromAppContext,
  isUiAuthData,
} from "pagopa-interop-commons";
import { ErrorMessage } from "pagopa-interop-error-message-parser";
import { unauthorizedError } from "pagopa-interop-models";

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

function getLocaleFromAcceptLanguageHeader(
  acceptLanguageHeader: string | undefined
): keyof ErrorMessage | undefined {
  if (!acceptLanguageHeader) {
    return undefined;
  }

  const acceptedLanguages = acceptLanguageHeader.split(",").map((lang) => {
    const [fullLanguage] = lang.split(";");
    if (fullLanguage.includes("-")) {
      const [language] = fullLanguage.toLocaleLowerCase().split("-");
      return language.trim();
    }
    return fullLanguage.trim();
  });

  for (const lang of acceptedLanguages) {
    if (lang === "it" || lang === "en") {
      return lang as keyof ErrorMessage;
    }
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
