/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
import { isAxiosError } from "axios";
import {
    validateClientKindAndPlatformState,
    validateRequestParameters,
    verifyClientAssertion,
    verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import {
    ClientId,
    GSIPKClientIdKid,
    makeTokenGenerationStatesClientKidPK,
    unsafeBrandId,
    TenantId,
    ApiError,
    JWKKeyES256,
    JWKKeyRS256,
    ClientAssertion,
} from "pagopa-interop-models";
import { isFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
    verifyDPoPProof,
    verifyDPoPProofSignature,
} from "pagopa-interop-dpop-validation";
import {
    cannotGetKeyWithClient,
    clientAssertionPublicKeyNotFound,
    tenantNotAllowed,
} from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { config } from "../config/config.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { M2MTokenValidationSteps } from "../../../api-clients/dist/m2mGatewayApiV3.js";

export function toolServiceBuilder(clients: PagoPAInteropBeClients) {
    return {
        async validateM2MTokenGeneration(
            clientId: string | undefined,
            clientAssertion: string,
            clientAssertionType: string,
            grantType: string,
            dpopProof: string,
            ctx: WithLogger<M2MGatewayAppContext>
        ): Promise<m2mGatewayApiV3.M2MTokenValidationResult> {
            ctx.logger.info(`Validating M2M token generation for client ${clientId}`);

            const { errors: parametersErrors } = validateRequestParameters({
                client_assertion: clientAssertion,
                client_assertion_type: clientAssertionType,
                grant_type: grantType,
                client_id: clientId,
            });

            const { data: jwt, errors: clientAssertionErrors } =
                verifyClientAssertion(
                    clientAssertion,
                    clientId,
                    config.clientAssertionAudience,
                    ctx.logger,
                    isFeatureFlagEnabled(
                        config,
                        "featureFlagClientAssertionStrictClaimsValidation"
                    )
                );

            if (parametersErrors || clientAssertionErrors) {
                return handleM2MValidationResults({
                    clientAssertionErrors: [
                        ...(parametersErrors ?? []),
                        ...(clientAssertionErrors ?? []),
                    ],
                });
            }

            const { data: keyData, errors: keyRetrieveErrors } = await retrieveM2MKey(
                clients,
                jwt,
                ctx
            );
            if (keyRetrieveErrors) {
                return handleM2MValidationResults({ keyRetrieveErrors });
            }

            const { key, clientInfo } = keyData;

            const dpopValidation = verifyDPoPProof({
                dpopProofJWS: dpopProof,
                expectedDPoPProofHtu: config.dpopHtuBase,
                expectedDPoPProofHtm: "POST",
                dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
                dpopProofDurationSeconds: config.dpopDurationSeconds,
            });

            if (dpopValidation.errors) {
                return handleM2MValidationResults(
                    {
                        dpopProofErrors: dpopValidation.errors,
                    },
                    clientInfo
                );
            }

            const { errors: signatureErrors } = await verifyClientAssertionSignature(
                clientAssertion,
                key,
                jwt.header.alg
            );
            if (signatureErrors) {
                return handleM2MValidationResults({ signatureErrors }, clientInfo);
            }

            const jwkPublicKey = JSON.parse(key.publicKey) as
                | JWKKeyRS256
                | JWKKeyES256;

            const { errors: dpopSignatureErrors } = await verifyDPoPProofSignature(
                dpopProof,
                jwkPublicKey
            );
            if (dpopSignatureErrors) {
                return handleM2MValidationResults(
                    { dpopProofErrors: dpopSignatureErrors },
                    clientInfo
                );
            }

            const { errors: platformStateErrors } =
                validateClientKindAndPlatformState(key, jwt);

            return handleM2MValidationResults(
                { platformStateErrors: platformStateErrors ?? [] },
                clientInfo
            );
        },
    };
}

export type ToolService = ReturnType<typeof toolServiceBuilder>;

async function retrieveM2MKey(
    { authorizationClient }: PagoPAInteropBeClients,
    jwt: ClientAssertion,
    ctx: WithLogger<M2MGatewayAppContext>
) {
    const keyWithClient = await authorizationClient.token
        .getKeyWithClientByKeyId({
            params: {
                clientId: jwt.payload.sub,
                keyId: jwt.header.kid,
            },
            headers: ctx.headers,
        })
        .catch((e) => {
            if (isAxiosError(e) && e.response?.status === 404) {
                return undefined;
            }
            throw cannotGetKeyWithClient(jwt.payload.sub, jwt.header.kid);
        });

    if (!keyWithClient) {
        return {
            errors: [
                clientAssertionPublicKeyNotFound(jwt.header.kid, jwt.payload.sub),
            ],
        };
    }

    if (ctx.authData.organizationId !== keyWithClient.data.client.consumerId) {
        throw tenantNotAllowed(keyWithClient.data.client.id);
    }

    const clientKey = await authorizationClient.client.getClientKeyById({
        headers: ctx.headers,
        params: {
            clientId: keyWithClient.data.client.id,
            keyId: jwt.header.kid,
        },
    });

    const { encodedPem } = clientKey.data;

    const client = keyWithClient.data.client;
    const clientName = client.visibility === "FULL" ? client.name : "N/A";

    return {
        data: {
            clientInfo: {
                id: client.id,
                name: clientName,
                organizationId: client.consumerId,
            },
            key: {
                PK: makeTokenGenerationStatesClientKidPK({
                    clientId: unsafeBrandId<ClientId>(client.id),
                    kid: jwt.header.kid,
                }),
                clientKind: client.kind,
                GSIPK_clientId_kid: unsafeBrandId<GSIPKClientIdKid>(jwt.header.kid),
                publicKey: encodedPem,
                GSIPK_clientId: unsafeBrandId<ClientId>(client.id),
                consumerId: unsafeBrandId<TenantId>(client.consumerId),
                updatedAt: new Date().toISOString(),
            },
        },
    };
}

function handleM2MValidationResults(
    errs: {
        clientAssertionErrors?: Array<ApiError<string>>;
        keyRetrieveErrors?: Array<ApiError<string>>;
        signatureErrors?: Array<ApiError<string>>;
        platformStateErrors?: Array<ApiError<string>>;
        dpopProofErrors?: Array<ApiError<string>>;
    },
    clientInfo?: m2mGatewayApiV3.M2MClientInfo
): m2mGatewayApiV3.M2MTokenValidationResult {
    const stepErrs = {
        ca: errs.clientAssertionErrors ?? [],
        kr: errs.keyRetrieveErrors ?? [],
        sig: errs.signatureErrors ?? [],
        ps: errs.platformStateErrors ?? [],
        dpop: errs.dpopProofErrors ?? [],
    };

    return {
        clientInfo,
        steps: {
            clientAssertionStructure: {
                result: getStepResult([], stepErrs.ca),
                failures: apiErrorsToValidationFailures(stepErrs.ca),
            },
            clientExistenceVerification: {
                result: getStepResult(stepErrs.ca, stepErrs.kr),
                failures: apiErrorsToValidationFailures(stepErrs.kr),
            },
            publicKeyRetrieve: {
                result: getStepResult([...stepErrs.ca, ...stepErrs.kr], []),
                failures: [],
            },
            signatureVerification: {
                result: getStepResult([...stepErrs.ca, ...stepErrs.kr], stepErrs.sig),
                failures: apiErrorsToValidationFailures(stepErrs.sig),
            },
            dpopProofValidation: {
                result: getStepResult(
                    [...stepErrs.ca, ...stepErrs.kr, ...stepErrs.sig],
                    stepErrs.dpop
                ),
                failures: apiErrorsToValidationFailures(stepErrs.dpop),
            },
            platformStateVerification: {
                result: getStepResult(
                    [...stepErrs.ca, ...stepErrs.kr, ...stepErrs.sig],
                    stepErrs.ps
                ),
                failures: apiErrorsToValidationFailures(stepErrs.ps),
            },
        } as M2MTokenValidationSteps,
    };
}

function getStepResult(
    prevStepErrors: Array<ApiError<string>>,
    currentStepErrors: Array<ApiError<string>>
): m2mGatewayApiV3.ValidationStep["result"] {
    if (currentStepErrors.length > 0) {
        return "FAILED";
    } else if (prevStepErrors.length > 0) {
        return "SKIPPED";
    } else {
        return "PASSED";
    }
}

function apiErrorsToValidationFailures<T extends string>(
    errors: Array<ApiError<T>> | undefined
): m2mGatewayApiV3.ValidationFailure[] {
    if (!errors) {
        return [];
    }

    return errors.map((err) => ({
        code: err.code,
        reason: err.message,
    }));
}
