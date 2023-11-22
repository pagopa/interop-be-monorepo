/* eslint-disable sonarjs/no-identical-functions */
import { ApiError } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { errorCodes } from "../model/domain/errors.js";

export const createAgreementErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.notLatestEServiceDescriptor,
      errorCodes.descriptorNotInExpectedState,
      errorCodes.missingCertifiedAttributesError,
      errorCodes.eServiceNotFound,
      () => 400
    )
    .with(errorCodes.agreementAlreadyExists, () => 409)
    .otherwise(() => 500);

export const deleteAgreementErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(errorCodes.agreementNotFound, () => 404)
    .with(errorCodes.agreementNotInExpectedState, () => 400)
    .with(errorCodes.operationNotAllowed, () => 403)
    .otherwise(() => 500);

export const updateAgreementErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(errorCodes.agreementNotFound, () => 404)
    .with(errorCodes.agreementNotInExpectedState, () => 400)
    .with(errorCodes.operationNotAllowed, () => 403)
    .otherwise(() => 500);

export const submitAgreementErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.notLatestEServiceDescriptor,
      errorCodes.agreementNotInExpectedState,
      errorCodes.consumerWithNotValidEmail,
      errorCodes.agreementSubmissionFailed,
      errorCodes.missingCertifiedAttributesError,
      errorCodes.descriptorNotInExpectedState,
      () => 400
    )
    .with(errorCodes.agreementNotFound, () => 404)
    .with(errorCodes.operationNotAllowed, () => 403)
    .with(errorCodes.agreementAlreadyExists, () => 409)
    .otherwise(() => 500);
