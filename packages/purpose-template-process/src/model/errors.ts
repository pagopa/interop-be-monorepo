import {
  ApiError,
  makeApiProblemBuilder,
  PurposeTemplateId,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeTemplateNotFound: "0001",
};

export function purposeTemplateNotFound(
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Purpose Template found for ID ${purposeTemplateId}`,
    code: "purposeTemplateNotFound",
    title: "Purpose Template Not Found",
  });
}

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);
