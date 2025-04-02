import { IS_BROWSER } from "./environment.ts";

export function saveFile(
	content: string,
	fileName: string,
	type: "csv" | "markdown",
) {
	try {
		const fileExtension = type === "csv" ? "csv" : "md";
		if (IS_BROWSER) {
			// @ts-expect-error - Document is not defined in Node.js
			const a = document.createElement("a");
			a.href = URL.createObjectURL(
				new Blob([content], { type: `text/${type}` }),
			);
			a.download = `${fileName}.${fileExtension}`;
			a.click();
			URL.revokeObjectURL(a.href);
		} else {
			import("node:fs").then(({ writeFileSync }) => {
				const filePath = `/tmp/${fileName}.${fileExtension}`;
				writeFileSync(filePath, content, {
					encoding: "utf-8",
				});
				// biome-ignore lint/suspicious/noConsoleLog: <explanation>
				// biome-ignore lint/suspicious/noConsole: <explanation>
				console.log(`Saved file to ${filePath}`);
			});
		}
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.error("Error saving file:", error);
	}
}
