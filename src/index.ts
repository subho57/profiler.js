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
	readonly getResults: () => ProfilerResult[];
	/**
	 * Logs the results in a prettified format to the console using console.table
	 */
	readonly log: () => void;
};

export const profiler: Profiler = {
	functionData: {},
	componentData: {},
	enabled: IS_DEV,
	getResults: () => {
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
		// console.table(functionDataArray);
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
