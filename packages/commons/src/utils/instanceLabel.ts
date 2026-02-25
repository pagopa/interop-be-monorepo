/**
 * Builds the instance name from the template name and optional instance label.
 * - templateName: maxLength 45
 * - separator " - ": 3 characters
 * - instanceLabel: maxLength 12
 * - eservice name (result): maxLength 60
 */
export const buildInstanceName = (
  templateName: string,
  instanceLabel: string | undefined
): string =>
  instanceLabel ? `${templateName} - ${instanceLabel}` : templateName;
