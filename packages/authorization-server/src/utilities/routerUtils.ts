import { constants } from "http2";
import { Response } from "express";
import {
  AuthServerAppContext,
  logger,
  WithLogger,
} from "pagopa-interop-commons";
import {
  ClientId,
  ClientKindTokenGenStates,
  Problem,
  TenantId,
  tooManyRequestsError,
} from "pagopa-interop-models";
import { makeApiProblem } from "../model/domain/errors.js";
import { asyncAuthorizationServerErrorMapper } from "./asyncErrorMappers.js";
import { authorizationServerErrorMapper } from "./errorMappers.js";

export function buildCtxHelpers(reqCtx: AuthServerAppContext): {
  getCtx: () => WithLogger<AuthServerAppContext>;
  setCtxClientId: (clientId: ClientId) => void;
  setCtxOrganizationId: (organizationId: TenantId) => void;
  setCtxClientKind: (tokenGenClientKind: ClientKindTokenGenStates) => void;
} {
  const setCtxClientId = (clientId: ClientId): void => {
    // eslint-disable-next-line functional/immutable-data
    reqCtx.clientId = clientId;
  };

  const setCtxOrganizationId = (organizationId: TenantId): void => {
    // eslint-disable-next-line functional/immutable-data
    reqCtx.organizationId = organizationId;
  };

  const setCtxClientKind = (
    tokenGenClientKind: ClientKindTokenGenStates
  ): void => {
    // eslint-disable-next-line functional/immutable-data
    reqCtx.clientKind = tokenGenClientKind;
  };

  const getCtx = (): WithLogger<AuthServerAppContext> => ({
    ...reqCtx,
    logger: logger({ ...reqCtx }),
  });

  return { getCtx, setCtxClientId, setCtxOrganizationId, setCtxClientKind };
}

export function handleTokenError(
  err: unknown,
  ctx: WithLogger<AuthServerAppContext>
): Problem {
  const errorRes = makeApiProblem(err, authorizationServerErrorMapper, ctx);

  if (errorRes.status === constants.HTTP_STATUS_BAD_REQUEST) {
    return {
      title: "The request contains bad syntax or cannot be fulfilled.",
      type: "about:blank",
      status: constants.HTTP_STATUS_BAD_REQUEST,
      detail: "Bad request",
      errors: [
        {
          code: "015-0008",
          detail: "Unable to generate a token for the given request",
        },
      ],
      correlationId: ctx.correlationId,
    };
  }

  return {
    title: "The request couldn't be fulfilled due to an internal error",
    type: "internalServerError",
    status: constants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
    detail: "Internal server error",
    errors: [
      {
        code: "015-0000",
        detail:
          "Unable to generate a token for the given request due to an internal error",
      },
    ],
    correlationId: ctx.correlationId,
  };
}

export function handleAsyncTokenError(
  err: unknown,
  ctx: WithLogger<AuthServerAppContext>
): Problem {
  const errorRes = makeApiProblem(
    err,
    asyncAuthorizationServerErrorMapper,
    ctx
  );

  if (errorRes.status === constants.HTTP_STATUS_BAD_REQUEST) {
    return {
      title: "The request contains bad syntax or cannot be fulfilled.",
      type: "about:blank",
      status: constants.HTTP_STATUS_BAD_REQUEST,
      detail: "Bad request",
      errors: [
        {
          code: "015-0008",
          detail: "Unable to generate a token for the given request",
        },
      ],
      correlationId: ctx.correlationId,
    };
  }

  return {
    title: "The request couldn't be fulfilled due to an internal error",
    type: "internalServerError",
    status: constants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
    detail: "Internal server error",
    errors: [
      {
        code: "015-0000",
        detail:
          "Unable to generate a token for the given request due to an internal error",
      },
    ],
    correlationId: ctx.correlationId,
  };
}

export function handleRateLimitResponse(
  res: Response,
  rateLimitedTenantId: TenantId,
  ctx: WithLogger<AuthServerAppContext>
): void {
  const errorRes = makeApiProblem(
    tooManyRequestsError(rateLimitedTenantId),
    authorizationServerErrorMapper,
    ctx
  );

  res.status(errorRes.status).send(errorRes);
}
