import {
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
} from "../model/domain/errors.js";

export const assertConsistentFreeOfCharge = (
  isFreeOfCharge: boolean,
  freeOfChargeReason: string | undefined
): void => {
  if (isFreeOfCharge && !freeOfChargeReason) {
    throw missingFreeOfChargeReason();
  }
};

export const assertValidPuposeTemplateName = (
  purposeTemplateName: string | undefined
): void => {
  if (!purposeTemplateName || purposeTemplateName.length < 3) {
    throw purposeTemplateNameConflict();
  }
};
