import node from "pagopa-interop-eslint-config/node";

export default [
	...node,
	{
		files: ["test/**/*.ts"],
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.check.json",
				projectService: false,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
];
