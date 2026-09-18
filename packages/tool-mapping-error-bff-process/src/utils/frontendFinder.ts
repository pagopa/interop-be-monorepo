import { readFileSync } from "fs";
import ts from "typescript";

import { FrontendServiceFile } from "../models/index.js";
import {
  getFrontendServiceFileList,
  getFrontendTypescriptFiles,
} from "./filePaths.js";
import { normalizePath } from "./openApi.js";

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);

export function findPathInService(
  path: string,
  method: string
): FrontendServiceFile | undefined {
  const serviceFiles = getFrontendServiceFileList();

  const normalizedPath = normalizePath(path);
  const normalizedMethod = method.toLowerCase();

  for (const file of serviceFiles) {
    const source = ts.sys.readFile(file);

    if (!source) {
      continue;
    }

    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    let result: FrontendServiceFile | undefined;

    function visit(node: ts.Node): void {
      if (result) {
        return;
      }

      const functionName = getFunctionName(node);

      if (functionName) {
        const body = getFunctionBody(node);

        if (body && containsMatchingAxiosCall(body)) {
          result = {
            file,
            functionName,
          };

          return;
        }
      }

      ts.forEachChild(node, visit);
    }

    function getFunctionName(node: ts.Node): string | undefined {
      // async function archive(...) {}
      if (ts.isFunctionDeclaration(node) && node.name) {
        return node.name.text;
      }

      // async updateTenantDelegatedFeatures(...) {}
      if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
        return node.name.text;
      }

      // archive: async (...) => {}
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      ) {
        return node.name.text;
      }

      // const archive = async (...) => {}
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      ) {
        return node.name.text;
      }

      return undefined;
    }

    function getFunctionBody(node: ts.Node): ts.Node | undefined {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        return node.body;
      }

      if (ts.isPropertyAssignment(node)) {
        const initializer = node.initializer;

        if (
          initializer &&
          (ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer))
        ) {
          return initializer.body;
        }
      }

      if (ts.isVariableDeclaration(node)) {
        const initializer = node.initializer;

        if (
          initializer &&
          (ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer))
        ) {
          return initializer.body;
        }
      }

      return undefined;
    }

    function containsMatchingAxiosCall(node: ts.Node): boolean {
      let found = false;

      function visitCall(child: ts.Node): void {
        if (found) {
          return;
        }

        if (ts.isCallExpression(child)) {
          const axiosCall = getAxiosCall(child);

          if (
            axiosCall &&
            axiosCall.method === normalizedMethod &&
            normalizePath(axiosCall.path) === normalizedPath
          ) {
            found = true;
            return;
          }
        }

        ts.forEachChild(child, visitCall);
      }

      visitCall(node);

      return found;
    }

    function getAxiosCall(node: ts.CallExpression):
      | {
          method: string;
          path: string;
        }
      | undefined {
      if (!ts.isPropertyAccessExpression(node.expression)) {
        return undefined;
      }

      const method = node.expression.name.text.toLowerCase();

      if (!HTTP_METHODS.has(method)) {
        return undefined;
      }

      const firstArgument = node.arguments[0];

      if (!firstArgument) {
        return undefined;
      }

      const path = getHttpPath(firstArgument);

      if (path === undefined) {
        return undefined;
      }

      return {
        method,
        path,
      };
    }

    function getHttpPath(expression: ts.Expression): string | undefined {
      // "/foo/bar"
      if (ts.isStringLiteral(expression)) {
        return expression.text;
      }

      // `"/foo/bar"`
      if (ts.isNoSubstitutionTemplateLiteral(expression)) {
        return expression.text;
      }

      // `${BACKEND_FOR_FRONTEND_URL}/foo/${id}/bar`
      if (ts.isTemplateExpression(expression)) {
        let path = expression.head.text;

        for (const span of expression.templateSpans) {
          const expressionText = span.expression.getText(sourceFile);

          if (expressionText === "BACKEND_FOR_FRONTEND_URL") {
            // Ignore the backend URL.
          } else {
            // Every dynamic path parameter becomes {}.
            path += "{}";
          }

          path += span.literal.text;
        }

        return path;
      }

      return undefined;
    }

    visit(sourceFile);

    if (result) {
      return result;
    }
  }

  return undefined;
}

type FunctionCall = {
  file: string;
  lineNumber: number;
};

function findContainingFunctionName(
  sourceFile: ts.SourceFile,
  position: number
): string | undefined {
  let functionName: string | undefined;

  function visit(node: ts.Node): void {
    if (position < node.getStart(sourceFile) || position > node.getEnd()) {
      return;
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      functionName = node.name.text;
    }

    if (
      ts.isMethodDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      functionName = node.name.text;
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      functionName = node.name.text;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return functionName;
}

export function findFunctionCalls(
  serviceFileName: string,
  functionName: string
): FunctionCall[] {
  if (!functionName) {
    return [];
  }

  const serviceFile = readFileSync(serviceFileName, "utf8");

  const serviceObjectName = findServiceObjectName(serviceFile, functionName);

  if (!serviceObjectName) {
    return [];
  }

  const result: FunctionCall[] = [];

  const files = getFrontendTypescriptFiles();

  const callRegex = new RegExp(
    `\\b${escapeRegExp(serviceObjectName)}\\s*\\.\\s*${escapeRegExp(functionName)}\\s*\\(`,
    "g"
  );

  for (const file of files) {
    const content = readFileSync(file, "utf8");

    for (const match of content.matchAll(callRegex)) {
      const index = match.index;

      if (index === undefined) {
        continue;
      }

      const lineNumber = content.slice(0, index).split("\n").length;

      if (file.includes("__tests__")) {
        continue;
      }

      if (
        file.endsWith(".queries.ts") ||
        file.endsWith(".mutations.ts") ||
        file.endsWith(".hooks.ts") ||
        file.endsWith(".downloads.ts") ||
        file.endsWith(".services.ts")
      ) {
        const callerFunctionName = findContainingFunctionName(
          ts.createSourceFile(file, content, ts.ScriptTarget.Latest),
          index
        );

        if (!callerFunctionName) {
          continue;
        }

        const recursiveCalls = findFunctionCalls(file, callerFunctionName);

        result.push(...recursiveCalls);
      }

      result.push({
        file,
        lineNumber,
      });
    }
  }

  return result;
}

function findServiceObjectName(
  file: string,
  functionName: string
): string | undefined {
  const objectRegex = /export\s+const\s+(\w+)\s*=\s*\{/g;

  for (const match of file.matchAll(objectRegex)) {
    const objectName = match[1];

    if (match.index === undefined) {
      continue;
    }

    const openingBrace = match.index + match[0].lastIndexOf("{");

    const closingBrace = findMatchingBrace(file, openingBrace);

    if (closingBrace === -1) {
      continue;
    }

    const objectBody = file.slice(openingBrace + 1, closingBrace);

    /*
     * Handles:
     *
     * archive,
     *
     * and also:
     *
     * archive
     *
     * at the end of the object.
     */
    const functionRegex = new RegExp(
      `(?:^|,)\\s*${escapeRegExp(functionName)}\\s*(?:,|$)`,
      "m"
    );

    if (functionRegex.test(objectBody)) {
      return objectName;
    }
  }

  return undefined;
}

function findMatchingBrace(file: string, openingBrace: number): number {
  let depth = 0;

  for (let i = openingBrace; i < file.length; i++) {
    if (file[i] === "{") {
      depth++;
    } else if (file[i] === "}") {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
