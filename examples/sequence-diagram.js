import { profiler } from "../build/index.js";

// Make sure profiler is enabled
profiler.enabled = true;

// Manually populate the profiler with sample data
// This is more reliable for testing than trying to capture real data
const baseTime = performance.now();

// Sample data - simulating a flow of: App.init -> DataService.fetch -> Utils.parse -> DataService.process
profiler.functionData["App.init"] = {
	isPromise: false,
	executionDuration: [100],
	invocationTimestamps: [baseTime],
	threadBlockingDuration: [20],
};

profiler.functionData["DataService.fetch"] = {
	isPromise: true,
	executionDuration: [50],
	invocationTimestamps: [baseTime + 10],
	threadBlockingDuration: [5],
};

profiler.functionData["Utils.parse"] = {
	isPromise: false,
	executionDuration: [20],
	invocationTimestamps: [baseTime + 30],
	threadBlockingDuration: [15],
};

profiler.functionData["DataService.process"] = {
	isPromise: false,
	executionDuration: [15],
	invocationTimestamps: [baseTime + 60],
	threadBlockingDuration: [10],
};

// Sample circular pattern: Handler.start -> Service.process -> Handler.callback -> Service.process
profiler.functionData["Handler.start"] = {
	isPromise: false,
	executionDuration: [150],
	invocationTimestamps: [baseTime + 200],
	threadBlockingDuration: [30],
};

profiler.functionData["Service.process"] = {
	isPromise: false,
	executionDuration: [40, 40],
	invocationTimestamps: [baseTime + 220, baseTime + 300],
	threadBlockingDuration: [20, 20],
};

profiler.functionData["Handler.callback"] = {
	isPromise: false,
	executionDuration: [70],
	invocationTimestamps: [baseTime + 270],
	threadBlockingDuration: [15],
};
// Generate and display the sequence diagram
// biome-ignore lint/suspicious/noConsole: <explanation>
// biome-ignore lint/suspicious/noConsoleLog: <explanation>
console.log("\nGenerating sequence diagram:");
const diagram = profiler.generateSequenceDiagram();
// biome-ignore lint/suspicious/noConsole: <explanation>
// biome-ignore lint/suspicious/noConsoleLog: <explanation>
console.log(diagram);

// biome-ignore lint/suspicious/noConsole: <explanation>
// biome-ignore lint/suspicious/noConsoleLog: <explanation>
console.log("\nProfiler data:\n```bash\n");
profiler.log();
// biome-ignore lint/suspicious/noConsole: <explanation>
// biome-ignore lint/suspicious/noConsoleLog: <explanation>
console.log("```");
