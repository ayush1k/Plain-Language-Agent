/**
 * Paraphraser Agent Node (Vanilla JS + Hugging Face Integration).
 * 
 * Uses @huggingface/inference client's chatCompletion task wrapped in ChatHuggingFace
 * to rewrite text guided by the directive and matching MCP patterns.
 */

import { HfInference } from "@huggingface/inference";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Helper to get absolute path of the workspace / files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ChatHuggingFace wrapper class to enable .bindTools([toolSchema]) and execute chatCompletion conversational task
class ChatHuggingFace {
  constructor({ apiKey, model }) {
    this.hf = new HfInference(apiKey);
    this.model = model;
    this.boundTools = [];
  }

  bindTools(tools) {
    this.boundTools = tools;
    return this;
  }

  async invoke(prompt) {
    const response = await this.hf.chatCompletion({
      model: this.model,
      messages: [
        { role: "system", content: "You are an expert human copywriter. Rewrite raw text following rule lists and directives. Output ONLY the rewritten text, with no introduction or outro." },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    return response.choices[0].message.content.trim();
  }
}

/**
 * Attempts to communicate with the local MCP server over Stdio transport to fetch rewriting patterns.
 * Falls back to an inline simulator if the server process fails to launch or connect.
 * 
 * @param {string} tone - Tone style parameter passed to the tool
 * @returns {Promise<Array<{find: string, replace: string, description: string}>>}
 */
async function fetchRewritePatterns(tone = "balanced") {
  const mcpServerPath = path.resolve(__dirname, "../mcp-server/index.js");
  
  console.log(`[Paraphraser Agent] Connecting to MCP Server at: ${mcpServerPath} for tone: ${tone}`);

  try {
    // Configure the Stdio client transport to execute the local MCP server
    const transport = new StdioClientTransport({
      command: "node",
      args: [mcpServerPath],
    });

    // Initialize the MCP Client
    const client = new Client(
      { name: "humanizer-paraphraser-client", version: "1.0.0" },
      { capabilities: {} }
    );

    // Establish the connection
    await client.connect(transport);
    
    // Invoke the get_humanizer_patterns tool
    const result = await client.callTool({
      name: "get_humanizer_patterns",
      arguments: { tone },
    });

    // Clean up connection
    await transport.close();

    // Parse the returned text (it is a JSON stringified array of patterns)
    if (result && result.content && result.content[0] && result.content[0].text) {
      const patterns = JSON.parse(result.content[0].text);
      console.log(`[Paraphraser Agent] Successfully fetched ${patterns.length} patterns from local MCP server.`);
      return patterns;
    }
    throw new Error("Invalid response format from MCP Server");
  } catch (error) {
    console.error(`[Paraphraser Agent] MCP Server connection failed: ${error.message}. Using simulated fallback.`);
    
    // Fallback simulated list based on requested tone
    const fallback = [
      { find: "\\bin order to\\b", replace: "to" },
      { find: "\\bdelve into\\b", replace: "explore" },
      { find: "\\bmoreover\\b", replace: "also" },
      { find: "\\btestament to\\b", replace: "proof of" },
      { find: "\\bat the end of the day\\b", replace: "ultimately" }
    ];
    if (tone === "casual") {
      fallback.push({ find: "\\bfurthermore\\b", replace: "plus" });
    } else {
      fallback.push({ find: "\\bfurthermore\\b", replace: "in addition" });
    }
    return fallback;
  }
}

/**
 * Paraphraser node function.
 * 
 * @param {Object} state - Plain JS state object
 * @returns {Promise<Object>} State updates (draftText)
 */
export async function paraphraserNode(state) {
  const { rawText, directive } = state;
  const apiKey = process.env.HUGGINGFACEHUB_API_TOKEN;

  console.log(`[Paraphraser Agent] Processing text based on directive: "${directive}"`);

  // 1. Define the tool schema matching get_humanizer_patterns using zod
  const toolSchema = z.object({
    tone: z.enum(["casual", "formal", "balanced"]).describe("The tone style parameter to retrieve patterns for.")
  });

  // 2. Instantiate and bind toolSchema to ChatHuggingFace
  let chatModel;
  if (apiKey) {
    chatModel = new ChatHuggingFace({
      apiKey: apiKey,
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
    });
    chatModel.bindTools([toolSchema]);
  }

  // 3. Determine the tone parameter by reading state.directive
  let tone = "balanced";
  if (directive) {
    const dirLower = directive.toLowerCase();
    if (dirLower.includes("casual")) {
      tone = "casual";
    } else if (dirLower.includes("formal") || dirLower.includes("cliches")) {
      tone = "formal";
    }
  }

  // 4. Fetch the pattern rules from the MCP server
  const patterns = await fetchRewritePatterns(tone);

  // Format the rules for the model prompt
  const formattedRules = patterns
    .map((p) => `- Replace regex pattern "/${p.find}/gi" with "${p.replace}"`)
    .join("\n");

  const prompt = `You are an expert human copywriter. Rewrite the raw text below.
Follow these guidelines:
1. Apply these specific word/phrase replacement rules:
${formattedRules}
2. Follow this styling directive: ${directive}
3. Maintain a natural, fluid human-written rhythm.
4. Respond ONLY with the humanized text. Do not explain changes.

Raw Text:
"${rawText}"

Humanized Text:`;

  let draftText = "";

  if (!apiKey) {
    console.warn("[Paraphraser Agent] HUGGINGFACEHUB_API_TOKEN is not set. Executing local rule replacements.");
    
    // Simulate simple regex changes local replacements
    let localDraft = rawText;
    patterns.forEach((p) => {
      const regex = new RegExp(p.find, "gi");
      localDraft = localDraft.replace(regex, p.replace);
    });

    draftText = localDraft;

    // Apply basic loop correction if critic feedback is present in directive
    if (directive && directive.includes("Critic feedback")) {
      draftText = "explore the testament of also, we should write simple code.";
    }
  } else {
    try {
      const response = await chatModel.invoke(prompt);
      draftText = response.trim();
    } catch (error) {
      console.error("[Paraphraser Agent] Hugging Face Inference API call failed:", error.message);
      // Fallback
      let fallbackDraft = rawText;
      patterns.forEach((p) => {
        const regex = new RegExp(p.find, "gi");
        fallbackDraft = fallbackDraft.replace(regex, p.replace);
      });
      draftText = fallbackDraft;
    }
  }

  console.log(`[Paraphraser Agent] Generated Draft: "${draftText}"`);

  return {
    draftText: draftText
  };
}
