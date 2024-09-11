import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as APIGatewayErrorCodes } from "../models/errors.js";

type ErrorCodes = APIGatewayErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants;

export const getAgreementErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("invalidAgreementState", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAgreementsErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("producerAndConsumerParamMissing", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const emptyErrorMapper = (): number => HTTP_STATUS_INTERNAL_SERVER_ERROR;
