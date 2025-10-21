export const insertSignedBeforeExtension = (fileKey: string): string => {
  const dotIndex = fileKey.lastIndexOf(".");
  if (dotIndex === -1) {
    return `${fileKey}-signed`;
  }
  const name = fileKey.slice(0, dotIndex);
  const ext = fileKey.slice(dotIndex);
  return `${name}-signed${ext}`;
};
