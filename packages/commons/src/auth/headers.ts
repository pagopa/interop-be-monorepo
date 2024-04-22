import { Request } from "express";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { missingBearer, missingHeader } from "pagopa-interop-models";

const RawAuthHeaders = z.object({
  authorization: z.string().nullish(),
  "x-correlation-id": z.string().nullish(),
});
type RawAuthHeaders = z.infer<typeof RawAuthHeaders>;

type ParsedAuthHeaders = {
  correlationId: string;
  token: string;
};

export const readHeaders = (req: Request): ParsedAuthHeaders => {
  const headers = RawAuthHeaders.safeParse(req.headers);
  if (!headers.success) {
    throw missingHeader();
  }

  return match<RawAuthHeaders, ParsedAuthHeaders>(req.headers)
    .with(
      {
        authorization: P.string,
        "x-correlation-id": P.string,
      },
      (headers) => {
        const authorizationHeader = headers.authorization.split(" ");
        if (
          authorizationHeader.length !== 2 ||
          authorizationHeader[0] !== "Bearer"
        ) {
          throw missingBearer;
        }

        const token = authorizationHeader[1];

        return {
          token,
          correlationId: headers["x-correlation-id"],
        };
      }
    )
    .with(
      {
        authorization: P.nullish,
        "x-correlation-id": P._,
      },
      () => {
        throw missingHeader("authorization");
      }
    )
    .with(
      {
        authorization: P._,
        "x-correlation-id": P.nullish,
      },
      () => {
        throw missingHeader("x-correlation-id");
      }
    )
    .exhaustive();
};
