import { readFileSync } from "node:fs";
import { z } from "zod";

const ErrorMapper = z.object({
  name: z.string(),
  file: z.string(),
});

type ErrorMapper = z.infer<typeof ErrorMapper>;

const Service = z.object({
  name: z.string(),
  method: z.string(),
  file: z.string(),
});

type Service = z.infer<typeof Service>;

const Endpoint = z.object({
  method: z.string(),
  path: z.string(),
  fileName: z.string(),
  service: Service,
  mapper: ErrorMapper,
  roles: z.array(z.string()),
});

type Endpoint = z.infer<typeof Endpoint>;

function processRouter(fileName: string): Endpoint[] {
  const out: Endpoint[] = [];
  const file = readFileSync(fileName, "utf8");

  const endpointRegex =
    /\.(get|post|put|patch|delete|options|head|trace)\(\s*"([^"]+)"([\s\S]*?)(?=\n\s*\.(?:get|post|put|patch|delete|options|head|trace)\(|$)/g;

  for (const match of file.matchAll(endpointRegex)) {
    const [, method, path, body] = match;

    const serviceMatch = body.match(/[a-zA-Z]+Service\.(\w+)\s*\(/);

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
      fileName,
      service: {
        name: "TODO",
        method: serviceMatch?.[1] ?? "NOT FOUND",
        file: "TODO",
      },
      mapper: {
        name: mapperMatch?.[1] ?? "NOT FOUND",
        file: "TODO",
      },
      roles: roles ? roles.split(", ").map((role) => role.trim()) : [],
    });
  }
  return out;
}

const router = processRouter(process.argv[2]);
console.log(JSON.stringify(router, null, 2));
