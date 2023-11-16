import { AuthenticationProviderArgs, Authenticator } from "kafkajs";
import { authenticationSaslFailed } from "pagopa-interop-models";
import { TYPE } from "./constants.js";
import { Options } from "./create-mechanism.js";
import { CreatePayload } from "./create-payload.js";
import { createSaslAuthenticationRequest } from "./create-sasl-authentication-request.js";
import { createSaslAuthenticationResponse } from "./create-sasl-authentication-response.js";

export const createAuthenticator =
  (options: Options) =>
  (args: AuthenticationProviderArgs): Authenticator => ({
    authenticate: async (): Promise<void> => {
      const { host, port, logger, saslAuthenticate } = args;
      const broker = `${host}:${port}`;
      const payloadFactory = new CreatePayload(options);

      try {
        const payload = await payloadFactory.create({ brokerHost: host });
        const authenticateResponse = await saslAuthenticate({
          request: createSaslAuthenticationRequest(payload),
          response: createSaslAuthenticationResponse,
        });

        logger.info("Authentication response", { authenticateResponse });

        const isValidResponse =
          authenticateResponse &&
          typeof authenticateResponse === "object" &&
          "version" in authenticateResponse &&
          authenticateResponse.version;
        if (!isValidResponse) {
          throw authenticationSaslFailed("Invalid response from broker");
        }

        logger.info(`SASL ${TYPE} authentication successful`, { broker });
      } catch (error) {
        if (error instanceof Error) {
          logger.error(error?.message, { broker });
          throw authenticationSaslFailed(error?.message);
        } else if (typeof error === "string") {
          logger.error(error, { broker });
          throw authenticationSaslFailed(error);
        }
        throw authenticationSaslFailed(`Unknow error : ${error}`);
      }
    },
  });
