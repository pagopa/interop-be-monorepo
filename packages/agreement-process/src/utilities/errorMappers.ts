/* eslint-disable sonarjs/no-identical-functions */
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

export const createAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "notLatestEServiceDescriptor",
      "descriptorNotInExpectedState",
      "missingCertifiedAttributesError",
      "eServiceNotFound",
      () => 400
    )
    .with("agreementAlreadyExists", () => 409)
    .otherwise(() => 500);

export const deleteAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => 404)
    .with("agreementNotInExpectedState", () => 400)
    .with("operationNotAllowed", () => 403)
    .otherwise(() => 500);

export const updateAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => 404)
    .with("agreementNotInExpectedState", () => 400)
    .with("operationNotAllowed", () => 403)
    .otherwise(() => 500);

export const submitAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "notLatestEServiceDescriptor",
      "agreementNotInExpectedState",
      "consumerWithNotValidEmail",
      "agreementSubmissionFailed",
      "missingCertifiedAttributesError",
      "descriptorNotInExpectedState",
      () => 400
    )
    .with("agreementNotFound", () => 404)
    .with("operationNotAllowed", () => 403)
    .with("agreementAlreadyExists", "contractAlreadyExists", () => 409)
    .otherwise(() => 500);

export const addConsumerDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => 404)
    .with("operationNotAllowed", "documentsChangeNotAllowed", () => 403)
    .with("agreementDocumentAlreadyExists", () => 409)
    .otherwise(() => 500);

export const upgradeAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => 404)
    .with(
      "agreementNotInExpectedState",
      "publishedDescriptorNotFound",
      "noNewerDescriptor",
      () => 400
    )
    .with("operationNotAllowed", () => 403)
    .otherwise(() => 500);

export const cloneAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => 404)
    .with(
      "agreementNotInExpectedState",
      "missingCertifiedAttributesError",
      "eServiceNotFound",
      () => 400
    )
    .with("agreementAlreadyExists", () => 409)
    .with("operationNotAllowed", () => 403)
    .otherwise(() => 500);

export const getConsumerDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("documentNotFound", () => 404)
    .otherwise(() => 500);
