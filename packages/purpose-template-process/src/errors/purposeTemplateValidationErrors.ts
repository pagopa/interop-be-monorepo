import {
  EServiceId,
  InternalError,
  PurposeTemplateId,
} from "pagopa-interop-models";

type PurposeTemplateValidationIssueCode =
  | "unexpectedEServiceError"
  | "eserviceNotFound"
  | "unexpectedAssociationEServiceError"
  | "eserviceAlreadyAssociated"
  | "eserviceNotAssociated"
  | "missingDescriptor"
  | "invalidDescriptorState"
  | "unexpectedUnassociationEServiceError";

export class PurposeTemplateValidationIssue extends InternalError<PurposeTemplateValidationIssueCode> {
  constructor({
    code,
    detail,
  }: {
    code: PurposeTemplateValidationIssueCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export type purposeTemplateValidationInvalid = {
  type: "invalid";
  issues: PurposeTemplateValidationIssue[];
};

export type purposeTemplateValidationValid<T> = {
  type: "valid";
  value: T;
};

export type PurposeTemplateValidationResult<T> =
  | purposeTemplateValidationInvalid
  | purposeTemplateValidationValid<T>;

export function unexpectedEServiceError(
  reason: string,
  eserviceId: EServiceId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "unexpectedEServiceError",
    detail: `Unexpected error: ${reason} for eservice ${eserviceId}`,
  });
}

export function eserviceNotFound(
  eserviceId: EServiceId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "eserviceNotFound",
    detail: `EService ${eserviceId} not found`,
  });
}

export function unexpectedAssociationEServiceError(
  reason: string,
  eserviceId: EServiceId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "unexpectedAssociationEServiceError",
    detail: `Missing expected association for eservice ${eserviceId}: ${reason}`,
  });
}

export function unexpectedUnassociationEServiceError(
  reason: string,
  eserviceId: EServiceId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "unexpectedUnassociationEServiceError",
    detail: `Unexpected error: ${reason} for eservice ${eserviceId}`,
  });
}

export function eserviceAlreadyAssociatedError(
  eserviceId: EServiceId,
  purposeTemplateId: PurposeTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "eserviceAlreadyAssociated",
    detail: `EService ${eserviceId} is already associated with purpose template ${purposeTemplateId}`,
  });
}

export function eserviceNotAssociatedError(
  eserviceId: EServiceId,
  purposeTemplateId: PurposeTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "eserviceNotAssociated",
    detail: `EService ${eserviceId} is not associated with purpose template ${purposeTemplateId}`,
  });
}

export function missingDescriptorError(
  eserviceId: EServiceId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "missingDescriptor",
    detail: `EService ${eserviceId} has no descriptors.`,
  });
}

export function invalidDescriptorStateError(
  eserviceId: EServiceId,
  expectedStates: string[]
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "invalidDescriptorState",
    detail: `EService ${eserviceId} has no valid descriptors. Expected ${expectedStates.join(
      ", "
    )}.`,
  });
}

export function invalidPurposeTemplateResult(
  issues: PurposeTemplateValidationIssue[]
): purposeTemplateValidationInvalid {
  return {
    type: "invalid",
    issues,
  };
}

export function validPurposeTemplateResult<T>(
  value: T
): purposeTemplateValidationValid<T> {
  return {
    type: "valid",
    value,
  };
}
