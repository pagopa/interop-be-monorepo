export const ESERVICE_INSTANCE_NAME_SEPARATOR = " - ";

/** Trims the label and treats blank values as missing. */
export const parseEServiceInstanceLabel = (
  instanceLabel: string | undefined
): string | undefined => {
  const trimmedInstanceLabel = instanceLabel?.trim();
  return trimmedInstanceLabel && trimmedInstanceLabel.length > 0
    ? trimmedInstanceLabel
    : undefined;
};

/** Builds the catalog name shared by every e-service template instance. */
export const buildEServiceInstanceName = ({
  templateName,
  instanceLabel,
}: {
  templateName: string;
  instanceLabel: string | undefined;
}): string => {
  const parsedInstanceLabel = parseEServiceInstanceLabel(instanceLabel);
  return parsedInstanceLabel
    ? `${templateName}${ESERVICE_INSTANCE_NAME_SEPARATOR}${parsedInstanceLabel}`
    : templateName;
};
