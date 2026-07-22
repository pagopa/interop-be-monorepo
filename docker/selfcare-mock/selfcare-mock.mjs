import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
};

const toUserResource = (user) => ({
  id: user.id,
  name: user.name,
  surname: user.surname,
  email: user.email,
  role: "MANAGER",
  roles: user.roles,
});

const toProductResource = (product) => ({
  contractTemplatePath: "",
  contractTemplateVersion: "",
  description: product.title,
  id: product.id,
  roleMappings: {},
  title: product.title,
  urlBO: "",
});

const toUserInstitutionResource = (dataset, user) => {
  const tenant = dataset.tenants.find(
    (candidate) => candidate.selfcareId === user.tenantSelfcareId
  );

  if (!tenant) {
    return undefined;
  }

  const productRole = user.roles.at(0) ?? "admin";
  return {
    institutionDescription: tenant.name,
    institutionId: tenant.selfcareId,
    products: [
      {
        productId: dataset.product.id,
        productRole,
        productRoleLabel: productRole,
        role: "MANAGER",
        status: "ACTIVE",
      },
    ],
    userId: user.id,
  };
};

const notFound = (request, response, pathname) =>
  sendJson(response, 404, {
    status: 404,
    title: "Not Found",
    detail: `${request.method} ${pathname}`,
  });

export const createSelfcareMockServer = (dataset) =>
  createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const { pathname, searchParams } = requestUrl;

    if (request.method === "GET" && pathname === "/health") {
      return sendJson(response, 200, { status: "ok" });
    }

    const institutionMatch = pathname.match(/^\/institutions\/([^/]+)$/);
    if (request.method === "GET" && institutionMatch) {
      const tenant = dataset.tenants.find(
        (candidate) => candidate.selfcareId === institutionMatch[1]
      );
      if (!tenant) {
        return notFound(request, response, pathname);
      }

      return sendJson(response, 200, {
        id: tenant.selfcareId,
        description: tenant.name,
        externalId: tenant.externalId.value,
        institutionType: tenant.institutionType,
      });
    }

    const productsMatch = pathname.match(
      /^\/institutions\/([^/]+)\/products$/
    );
    if (request.method === "GET" && productsMatch) {
      const hasTenant = dataset.tenants.some(
        (tenant) => tenant.selfcareId === productsMatch[1]
      );
      const hasUser = dataset.users.some(
        (user) =>
          user.tenantSelfcareId === productsMatch[1] &&
          (!searchParams.get("userId") ||
            user.id === searchParams.get("userId"))
      );

      return sendJson(
        response,
        hasTenant && hasUser ? 200 : 404,
        hasTenant && hasUser
          ? [toProductResource(dataset.product)]
          : {
              status: 404,
              title: "Not Found",
              detail: `${request.method} ${pathname}`,
            }
      );
    }

    const institutionUsersMatch = pathname.match(
      /^\/institutions\/([^/]+)\/users$/
    );
    if (request.method === "GET" && institutionUsersMatch) {
      const requestedRoles = (searchParams.get("productRoles") ?? "")
        .split(",")
        .filter(Boolean);
      const users = dataset.users.filter(
        (user) =>
          user.tenantSelfcareId === institutionUsersMatch[1] &&
          (!searchParams.get("userId") ||
            user.id === searchParams.get("userId")) &&
          (requestedRoles.length === 0 ||
            requestedRoles.some((role) => user.roles.includes(role)))
      );

      return sendJson(response, 200, users.map(toUserResource));
    }

    if (request.method === "GET" && pathname === "/users") {
      const users = dataset.users.filter(
        (user) =>
          !searchParams.get("userId") || user.id === searchParams.get("userId")
      );
      return sendJson(
        response,
        200,
        users
          .map((user) => toUserInstitutionResource(dataset, user))
          .filter(Boolean)
      );
    }

    const userMatch = pathname.match(/^\/users\/([^/]+)$/);
    if (request.method === "GET" && userMatch) {
      const user = dataset.users.find((candidate) => candidate.id === userMatch[1]);
      if (!user) {
        return notFound(request, response, pathname);
      }

      return sendJson(response, 200, {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
      });
    }

    return notFound(request, response, pathname);
  });

const main = async () => {
  const datasetPath = process.env.SELFCARE_MOCK_DATASET;
  if (!datasetPath) {
    throw new Error("SELFCARE_MOCK_DATASET is required");
  }

  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
  const port = Number(process.env.PORT ?? 8006);
  createSelfcareMockServer(dataset).listen(port, "0.0.0.0", () => {
    console.log(`selfcare-mock listening on :${port}`);
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
