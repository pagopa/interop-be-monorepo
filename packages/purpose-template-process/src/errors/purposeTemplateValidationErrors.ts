import {
  DescriptorState,
  EService,
  EServiceDescriptorPurposeTemplate,
  EServiceId,
  EServiceTemplate,
  EServiceTemplateId,
  InternalError,
  PurposeTemplate,
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
  | "unexpectedUnassociationEServiceError"
  | "purposeTemplateEServicePersonalDataFlagMismatch"
  | "invalidDescriptorStateForPublicationError"
  | "eserviceIsInstanceOfEServiceTemplate"
  | "unexpectedEServiceTemplateError"
  | "eserviceTemplateNotFound"
  | "unexpectedAssociationEServiceTemplateError"
  | "eserviceTemplateAlreadyAssociated"
  | "missingEServiceTemplateVersion"
  | "invalidEServiceTemplateVersionState"
  | "purposeTemplateEServiceTemplatePersonalDataFlagMismatch"
  | "eserviceTemplateNotAssociated"
  | "unexpectedUnassociationEServiceTemplateError";

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

type purposeTemplateValidationInvalid = {
  type: "invalid";
  issues: PurposeTemplateValidationIssue[];
};

type purposeTemplateValidationValid<T> = {
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

export function invalidDescriptorStateForPublicationError(
  eserviceDecriptorPurposeTemplate: EServiceDescriptorPurposeTemplate,
  expectedStates: DescriptorState[]
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "invalidDescriptorStateForPublicationError",
    detail: `Descriptor ${
      eserviceDecriptorPurposeTemplate.descriptorId
    } of e-service ${
      eserviceDecriptorPurposeTemplate.eserviceId
    } is not valid for association with the purpose template ${
      eserviceDecriptorPurposeTemplate.purposeTemplateId
    }. Expected states: ${expectedStates.join(", ")}.`,
  });
}

export function purposeTemplateEServicePersonalDataFlagMismatch(
  eservice: EService,
  purposeTemplate: PurposeTemplate
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "purposeTemplateEServicePersonalDataFlagMismatch",
    detail: `EService ${eservice.id} personal data flag (${eservice.personalData}) does not match purpose template ${purposeTemplate.id} personal data flag (${purposeTemplate.handlesPersonalData}).`,
  });
}

export function eserviceIsInstanceOfEServiceTemplateError(
  eserviceId: EServiceId,
  eserviceTemplateId: EServiceTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "eserviceIsInstanceOfEServiceTemplate",
    detail: `EService ${eserviceId} is an instance of e-service template ${eserviceTemplateId} and cannot be linked directly to a purpose template. Link the e-service template instead.`,
  });
}

export function unexpectedEServiceTemplateError(
  reason: string,
  eserviceTemplateId: EServiceTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "unexpectedEServiceTemplateError",
    detail: `Unexpected error: ${reason} for e-service template ${eserviceTemplateId}`,
  });
}

export function eserviceTemplateNotFound(
  eserviceTemplateId: EServiceTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "eserviceTemplateNotFound",
    detail: `E-service template ${eserviceTemplateId} not found`,
  });
}

export function unexpectedAssociationEServiceTemplateError(
  reason: string,
  eserviceTemplateId: EServiceTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "unexpectedAssociationEServiceTemplateError",
    detail: `Missing expected association for e-service template ${eserviceTemplateId}: ${reason}`,
  });
}

export function eserviceTemplateAlreadyAssociatedError(
  eserviceTemplateId: EServiceTemplateId,
  purposeTemplateId: PurposeTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "eserviceTemplateAlreadyAssociated",
    detail: `E-service template ${eserviceTemplateId} is already associated with purpose template ${purposeTemplateId}`,
  });
}

export function missingEServiceTemplateVersionError(
  eserviceTemplateId: EServiceTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "missingEServiceTemplateVersion",
    detail: `E-service template ${eserviceTemplateId} has no versions.`,
  });
}

export function invalidEServiceTemplateVersionStateError(
  eserviceTemplateId: EServiceTemplateId,
  expectedStates: string[]
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "invalidEServiceTemplateVersionState",
    detail: `E-service template ${eserviceTemplateId} has no valid versions. Expected ${expectedStates.join(
      ", "
    )}.`,
  });
}

export function purposeTemplateEServiceTemplatePersonalDataFlagMismatch(
  eserviceTemplate: EServiceTemplate,
  purposeTemplate: PurposeTemplate
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "purposeTemplateEServiceTemplatePersonalDataFlagMismatch",
    detail: `E-service template ${eserviceTemplate.id} personal data flag (${eserviceTemplate.personalData}) does not match purpose template ${purposeTemplate.id} personal data flag (${purposeTemplate.handlesPersonalData}).`,
  });
}

export function eserviceTemplateNotAssociatedError(
  eserviceTemplateId: EServiceTemplateId,
  purposeTemplateId: PurposeTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "eserviceTemplateNotAssociated",
    detail: `E-service template ${eserviceTemplateId} is not associated with purpose template ${purposeTemplateId}`,
  });
}

export function unexpectedUnassociationEServiceTemplateError(
  reason: string,
  eserviceTemplateId: EServiceTemplateId
): PurposeTemplateValidationIssue {
  return new PurposeTemplateValidationIssue({
    code: "unexpectedUnassociationEServiceTemplateError",
    detail: `Unexpected error: ${reason} for e-service template ${eserviceTemplateId}`,
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
