/**
 * LangGraph Workflow definition for the Text Humanizer App (Vanilla JS Refactoring).
 * 
 * Flow:
 * START -> Profiler -> Paraphraser -> Critic
 *                       ^                |
 *                       |---[Rejected]---|
 *                       v
 *                      END [Approved]
 */

import { StateGraph, END, START } from "@langchain/langgraph";
import { profilerNode } from "../agents/profiler.js";
import { paraphraserNode } from "../agents/paraphraser.js";
import { criticNode } from "../agents/critic.js";

// 1. Define the StateGraph using a plain JavaScript configuration object with channels.
// Passing null as the channel value defaults to a simple overwrite channel.
const workflowStateConfig = {
  channels: {
    rawText: null,
    directive: null,
    draftText: null,
    status: null,
    gradeLevel: {
      value: (x, y) => y ?? x,
      default: () => "8",
    },
    readabilityScores: {
      value: (x, y) => y ?? x,
      default: () => ({ before: null, after: null }),
    },
  }
};

// 2. Instantiate StateGraph with the config object
const workflow = new StateGraph(workflowStateConfig)
  // Register nodes
  .addNode("profiler", profilerNode)
  .addNode("paraphraser", paraphraserNode)
  .addNode("critic", criticNode);

// 3. Define the sequential edges
workflow.addEdge(START, "profiler");
workflow.addEdge("profiler", "paraphraser");
workflow.addEdge("paraphraser", "critic");

// 4. Define the conditional edge from Critic
workflow.addConditionalEdges(
  "critic",
  (state) => {
    if (state.status === "approved") {
      return "approved";
    }
    return "rejected";
  },
  {
    approved: END,
    rejected: "paraphraser",
  }
);

// 5. Compile the graph
const graph = workflow.compile();

export { graph };
export default graph;
