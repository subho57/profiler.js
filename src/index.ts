import save from "save-file";
import { IS_DEV } from "./environment.ts";

export type ProfilerResult = {
	className: string;
	functionName: string;
	isPromise: boolean;
	threadBlockingDuration: {
		avg: number;
		min: number;
		max: number;
		p0: number;
		p99: number;
	};
	executionDuration: {
		avg: number;
		min: number;
		max: number;
		p0: number;
		p99: number;
	};
	invocationTimestamps: number[];
};

export type FunctionData = {
	isPromise: boolean;
	executionDuration: number[];
	invocationTimestamps: number[];
	threadBlockingDuration: number[];
};

export type Profiler = {
	readonly functionData: Record<string, FunctionData>;
	readonly componentData: Record<string, number[]>;
	enabled: boolean | (() => boolean);
	readonly getResults: (
		saveToFile?: boolean,
		fileName?: string,
	) => ProfilerResult[];
	/**
	 * Logs the results in a prettified format to the console using console.table
	 */
	readonly log: () => void;
	/**
	 * Generates a mermaid sequence diagram based on function invocation timestamps
	 * @param maxIterations - Maximum number of function calls to include in the diagram
	 * @param saveToFile - Whether to save the diagram to a file (default: false)
	 * @param fileName - Custom filename without extension (default: "sequence-diagram")
	 * @returns A string containing mermaid sequence diagram code
	 */
	readonly generateSequenceDiagram: (
		maxIterations?: number,
		saveToFile?: boolean,
		fileName?: string,
	) => string;
};

export const profiler: Profiler = {
	functionData: {},
	componentData: {},
	enabled: IS_DEV,
	getResults: (
		saveToFile = false,
		fileName = `profiler-results-${new Date().toISOString().replace(/[-:Z]/g, "")}`,
	) => {
		const functionDataArray = Object.entries(profiler.functionData)
			.map(([functionName, functionData]) => {
				return {
					className: functionName.includes(".")
						? functionName.split(".")[0]
						: "",
					functionName: functionName.includes(".")
						? functionName.split(".")[1]
						: functionName,
					isPromise: functionData.isPromise,
					threadBlockingDuration: {
						avg:
							functionData.threadBlockingDuration.reduce((a, b) => a + b, 0) /
							functionData.threadBlockingDuration.length,
						min: Math.min(...functionData.threadBlockingDuration),
						max: Math.max(...functionData.threadBlockingDuration),
						p0: functionData.threadBlockingDuration[0],
						p99: functionData.threadBlockingDuration[
							Math.floor(functionData.threadBlockingDuration.length * 0.99)
						],
					},
					executionDuration: {
						avg:
							functionData.executionDuration.reduce((a, b) => a + b, 0) /
							functionData.executionDuration.length,
						min: Math.min(...functionData.executionDuration),
						max: Math.max(...functionData.executionDuration),
						p0: functionData.executionDuration[0],
						p99: functionData.executionDuration[
							Math.floor(functionData.executionDuration.length * 0.99)
						],
					},
					invocationTimestamps: functionData.invocationTimestamps,
				};
			})
			.sort((a, b) => b.executionDuration.avg - a.executionDuration.avg);

		if (saveToFile) {
			const csvHeaders = [
				"Class Name",
				"Function Name",
				"Is Promise",
				"Thread Blocking Duration (avg) (ms)",
				"Thread Blocking Duration (min) (ms)",
				"Thread Blocking Duration (max) (ms)",
				"Thread Blocking Duration (p0) (ms)",
				"Thread Blocking Duration (p99) (ms)",
				"Execution Duration (avg) (ms)",
				"Execution Duration (min) (ms)",
				"Execution Duration (max) (ms)",
				"Execution Duration (p0) (ms)",
				"Execution Duration (p99) (ms)",
				"Invocation Count",
			];
			const csvData = functionDataArray.map((item) => [
				item.className,
				item.functionName,
				item.isPromise,
				item.threadBlockingDuration.avg,
				item.threadBlockingDuration.min,
				item.threadBlockingDuration.max,
				item.threadBlockingDuration.p0,
				item.threadBlockingDuration.p99,
				item.executionDuration.avg,
				item.executionDuration.min,
				item.executionDuration.max,
				item.executionDuration.p0,
				item.executionDuration.p99,
				item.invocationTimestamps.length,
			]);
			const csvContent = [
				csvHeaders.join(","),
				...csvData.map((row) => row.join(",")),
			].join("\n");
			save(csvContent, fileName);
		}
		return functionDataArray as ProfilerResult[];
	},
	log() {
		const results = profiler.getResults();
		const table = results.reduce(
			(acc, result) => {
				const index = result.className
					? `${result.className}.${result.functionName}`
					: result.functionName;
				acc[index] = {
					isPromise: result.isPromise,
					"Thread Blocking Duration (in ms)": result.threadBlockingDuration.avg,
					"Execution Duration (in ms)": result.executionDuration.avg,
					"Invocation Count": result.invocationTimestamps.length,
				};
				return acc;
			},
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			{} as Record<string, any>,
		);

		// biome-ignore lint/suspicious/noConsole: Need console.table
		console.table(table);
	},
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
	generateSequenceDiagram(
		maxIterations = 100,
		saveToFile = false,
		fileName = `sequence-diagram-${new Date().toISOString().replace(/[-:Z]/g, "")}`,
	) {
		// Get all function calls with timestamps
		const functionCalls: Array<{
			timestamp: number;
			functionName: string;
			duration: number;
			isPromise: boolean;
		}> = [];

		// Extract all function calls with their timestamps and durations
		for (const [name, data] of Object.entries(profiler.functionData)) {
			for (let i = 0; i < data.invocationTimestamps.length; i++) {
				const timestamp = data.invocationTimestamps[i];
				if (timestamp === undefined) {
					continue;
				}
				const duration = data.executionDuration[i] || 0;
				functionCalls.push({
					timestamp,
					functionName: name,
					duration,
					isPromise: data.isPromise,
				});
			}
		}

		// Sort by timestamp
		functionCalls.sort((a, b) => a.timestamp - b.timestamp);

		// If no function calls, return empty diagram
		if (functionCalls.length === 0) {
			return "```mermaid\nsequenceDiagram\n  Note over No Data: No function calls recorded\n```";
		}

		// Generate unique participants
		const participants = new Set<string>();
		for (const call of functionCalls) {
			participants.add(getParticipantName(call.functionName));
		}

		// Start building the diagram
		let diagram = "```mermaid\nsequenceDiagram\n";

		// Add participants
		for (const participant of participants) {
			diagram += `  participant ${participant}\n`;
		}

		// For detecting circular patterns
		const sequenceHistory: string[] = [];
		let currentSequence: string[] = [];
		let iterations = 0;

		// Process function calls and generate sequence
		for (let i = 0; i < Math.min(functionCalls.length, maxIterations); i++) {
			const currentCall = functionCalls[i];
			if (!currentCall) {
				continue;
			}

			const nextCall =
				i + 1 < functionCalls.length ? functionCalls[i + 1] : null;

			// Skip if we reached the limit
			if (iterations >= maxIterations) {
				break;
			}

			// Get participant names
			const source = getParticipantName(currentCall.functionName);

			// Add the call to current sequence
			currentSequence.push(currentCall.functionName);

			// If we have a next call within the current function's execution time
			if (
				nextCall &&
				nextCall.timestamp < currentCall.timestamp + currentCall.duration
			) {
				// Current likely called next
				const target = getParticipantName(nextCall.functionName);
				const arrowType = currentCall.isPromise ? "->>" : "->>";
				diagram += `  ${source}${arrowType}${target}: ${getMethodName(nextCall.functionName)}\n`;
			} else if (nextCall) {
				// Next call is separate
				if (i > 0) {
					// Show return to previous function if not the first call
					const prevCall = functionCalls[i - 1];
					if (prevCall && isWithinDuration(prevCall, currentCall)) {
						const source = getParticipantName(currentCall.functionName);
						const target = getParticipantName(prevCall.functionName);
						diagram += `  ${source}-->${target}: return\n`;
					}
				}
			}

			iterations++;

			// Check for circular patterns
			const sequenceStr = currentSequence.join("-");
			if (sequenceHistory.includes(sequenceStr)) {
				diagram += `  Note over ${source}: Circular pattern detected - diagram truncated\n`;
				break;
			}

			// Add the current sequence to history for detecting patterns
			if (currentSequence.length > 2) {
				sequenceHistory.push(sequenceStr);

				// Reset current sequence if we detect the end of a call chain
				if (!(nextCall && isWithinDuration(currentCall, nextCall))) {
					currentSequence = [];
				}
			}
		}

		// Close the diagram
		diagram += "```";

		// Save to file if requested
		if (saveToFile) {
			const mdContent = `# Function Execution Sequence Diagram\n\n${diagram}\n`;
			save(mdContent, fileName);
		}

		return diagram;

		// Helper functions
		function getParticipantName(fullName: string): string {
			// Handle class.method format
			if (fullName.includes(".")) {
				const parts = fullName.split(".");
				return parts[0] || fullName;
			}
			return fullName;
		}

		function getMethodName(fullName: string): string {
			// Handle class.method format
			if (fullName.includes(".")) {
				const parts = fullName.split(".");
				return parts[1] || fullName;
			}
			return fullName;
		}

		function isWithinDuration(
			parentCall: (typeof functionCalls)[0],
			childCall: (typeof functionCalls)[0],
		): boolean {
			return (
				childCall.timestamp >= parentCall.timestamp &&
				childCall.timestamp <= parentCall.timestamp + parentCall.duration
			);
		}
	},
};

function recordTiming(
	functionName: string,
	startTime: number,
	type: "execution" | "threadBlocking",
	isPromise: boolean,
) {
	const enabled =
		typeof profiler.enabled === "function"
			? profiler.enabled()
			: profiler.enabled;

	if (!enabled) {
		return;
	}

	const endTime = performance.now();
	const duration = endTime - startTime;

	if (duration !== 0) {
		profiler.functionData[functionName] = profiler.functionData[
			functionName
		] || {
			isPromise: isPromise,
			executionDuration: [],
			invocationTimestamps: [],
			threadBlockingDuration: [],
		};
		if (
			profiler.functionData[functionName].invocationTimestamps.at(-1) !==
			startTime
		) {
			profiler.functionData[functionName].invocationTimestamps.push(startTime);
		}
		profiler.functionData[functionName].isPromise = isPromise;
		profiler.functionData[functionName][`${type}Duration`].push(duration);
	}
}

function profilerDecorator(
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	target: any,
	propertyKey: string,
	descriptor: PropertyDescriptor,
) {
	const originalMethod = descriptor.value;

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	descriptor.value = function debug(...args: any[]) {
		const functionName = `${target.constructor.name === "Function" ? target.name : target.constructor.name}.${propertyKey}`;
		const startTime = performance.now();
		const result = originalMethod.apply(this, args);
		recordTiming(functionName, startTime, "threadBlocking", false);

		const isPromise = result && typeof result.finally === "function";

		if (!isPromise) {
			recordTiming(functionName, startTime, "execution", false);
			return result;
		}

		result.finally(() => {
			recordTiming(functionName, startTime, "execution", true);
		});

		return result;
	};

	return descriptor;
}

// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic property access
function profilerFunction<T extends (...args: any[]) => any>(fn: T): T {
	return function debug(...args: Parameters<T>): ReturnType<T> {
		const functionName = fn.name || "anonymous function";
		const startTime = performance.now();
		const result = fn(...args);
		recordTiming(functionName, startTime, "threadBlocking", false);

		const isPromiseLike =
			result &&
			typeof result === "object" &&
			result !== null &&
			"then" in result &&
			// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic property access
			typeof (result as any).then === "function";

		if (!isPromiseLike) {
			recordTiming(functionName, startTime, "execution", false);
			return result as ReturnType<T>;
		}

		// Handle promise-like objects
		(result as Promise<ReturnType<T>>).finally(() => {
			recordTiming(functionName, startTime, "execution", true);
		});

		return result as ReturnType<T>;
	} as T;
}

function profilerComponent(
	id: string,
	_phase: "mount" | "update" | "nested-update",
	actualDuration: number,
	_baseDuration: number,
	_startTime: number,
	_commitTime: number,
) {
	const enabled =
		typeof profiler.enabled === "function"
			? profiler.enabled()
			: profiler.enabled;

	if (!enabled) {
		return;
	}

	profiler.componentData[id] = profiler.componentData[id] || [];
	profiler.componentData[id].push(actualDuration);
}

// Export a named function that can be used both as a decorator and a function wrapper
// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic property access
export function profile<T extends (...args: any[]) => any>(fn: T): T;
export function profile(
	target: object,
	propertyKey: string,
	descriptor: PropertyDescriptor,
): PropertyDescriptor;
export function profile(
	id: string,
	phase: "mount" | "update" | "nested-update",
	actualDuration: number,
	baseDuration: number,
	startTime: number,
	commitTime: number,
): void;

// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic property access
export function profile<T extends (...args: any[]) => any>(
	targetOrFn: object | T | string,
	propertyKeyOrPhase?: string | "mount" | "update" | "nested-update",
	descriptorOrActualDuration?: PropertyDescriptor | number,
	baseDuration?: number,
	startTime?: number,
	commitTime?: number,
	// biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
): PropertyDescriptor | T | void {
	// When used as a method decorator
	if (
		propertyKeyOrPhase !== undefined &&
		descriptorOrActualDuration !== undefined
	) {
		if (
			typeof descriptorOrActualDuration === "number" &&
			typeof targetOrFn === "string" &&
			["mount", "update", "nested-update"].includes(
				propertyKeyOrPhase as string,
			) &&
			baseDuration !== undefined &&
			startTime !== undefined &&
			commitTime !== undefined
		) {
			profilerComponent(
				targetOrFn,
				propertyKeyOrPhase as "mount" | "update" | "nested-update",
				descriptorOrActualDuration,
				baseDuration,
				startTime,
				commitTime,
			);
			return;
		}
		return profilerDecorator(
			targetOrFn,
			propertyKeyOrPhase as string,
			descriptorOrActualDuration as PropertyDescriptor,
		) as PropertyDescriptor;
	}

	// When used as a function wrapper
	return profilerFunction(targetOrFn as T);
}
