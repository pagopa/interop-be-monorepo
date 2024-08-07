export const streamToString = (data: Uint8Array): string => {
  const decoder = new TextDecoder("utf-8");

  return decoder.decode(data);
};
