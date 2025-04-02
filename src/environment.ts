/** * @internal */
// biome-ignore lint/complexity/useLiteralKeys: <explanation>
export const IS_DEV = process.env["NODE_ENV"] === "development";

/** * @internal */
// biome-ignore lint/complexity/useLiteralKeys: <explanation>
export const IS_PROD = process.env["NODE_ENV"] === "production";

/** * @internal */
// @ts-expect-error - window is not defined in node
export const IS_BROWSER = typeof window !== "undefined";
