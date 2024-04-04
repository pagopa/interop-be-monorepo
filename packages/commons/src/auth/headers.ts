import { Request } from "express";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { AuthData } from "./authData.js";
import { readAuthDataFromJwtToken } from "./jwt.js";

export const Headers = z.object({
  authorization: z.string().nullish(),
  "x-correlation-id": z.string().nullish(),
});

export type Headers = z.infer<typeof Headers>;

export const ParsedHeaders = z
  .object({
    correlationId: z.string(),
  })
  .and(AuthData);
export type ParsedHeaders = z.infer<typeof ParsedHeaders>;

export const readHeaders = (req: Request): ParsedHeaders | undefined => {
  try {
    const headers = Headers.parse(req.headers);
    return match(headers)
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
            return undefined;
          }

          const jwtToken = authorizationHeader[1];
          const authData = readAuthDataFromJwtToken(jwtToken);

          return match(authData)
            .with(P.instanceOf(Error), () => undefined)
            .otherwise((authData: AuthData) => ({
              ...authData,
              correlationId: headers["x-correlation-id"],
            }));
        }
      )
      .otherwise(() => undefined);
  } catch (error) {
    return undefined;
  }
};
