import { Request } from "express";

export const extractRequestDetails = (
  req: Request
): { method: string; url: string } => {
  // 1. Normalize Method (HTM)
  const method = req.method.toUpperCase();

  // 2. Determine Protocol and Host
  const protocol = req.protocol;
  const host = req.get("host");

  // 3. Get Full Path (including query string)
  // req.originalUrl includes the mount point (e.g., "/v3") and query params (e.g., "?q=1")
  const fullPath = req.originalUrl;

  // 4. Construct Full URL (HTU)
  const url = `${protocol}://${host}${fullPath}`;

  return { method, url };
};
