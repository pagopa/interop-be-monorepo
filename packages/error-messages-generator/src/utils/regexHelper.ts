type RouterEndpoint = {
  method: string;
  path: string;
  serviceName?: string;
  serviceMethod?: string;
  mapper?: string;
  roles: string[];
};

export function extractRouterEndpoints(file: string): RouterEndpoint[] {
  const endpointRegex =
    /\.(get|post|put|patch|delete|options|head|trace)\(\s*"([^"]+)"([\s\S]*?)(?=\n\s*\.(?:get|post|put|patch|delete|options|head|trace)\(|$)/g;
  const out: RouterEndpoint[] = [];
  for (const match of file.matchAll(endpointRegex)) {
    const [, method, path, body] = match;

    const serviceMatch = body.match(/([a-zA-Z]\w*Service)\.(\w+)\s*\(/);

    const mapperMatch = body.match(/makeApiProblem\(\s*[\s\S]*?,\s*(\w+),/);

    const rolesMatch = body.match(
      /validateAuthorization\(\s*ctx,\s*\[([^\]]+)\]/,
    );

    const roles = rolesMatch
      ? rolesMatch[1]
          .split(",")
          .map((role) => role.trim())
          .join(", ")
      : "";

    out.push({
      method,
      path,
      serviceName: serviceMatch?.[1],
      serviceMethod: serviceMatch?.[2],
      mapper: mapperMatch?.[1],
      roles: (roles ? roles.split(", ").map((role) => role.trim()) : []).filter(
        Boolean,
      ),
    });
  }
  return out;
}
