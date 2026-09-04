// Remove non-ASCII characters to create a secure file name (RFC 2047)
export function sanitizeFilenameToAscii(filename: string): string {
  // eslint-disable-next-line no-control-regex
  return filename.replace(/[^\x00-\x7F]/g, "_");
}
