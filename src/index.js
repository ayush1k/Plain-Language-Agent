#!/usr/bin/env node
try {
  process.loadEnvFile();
} catch (e) {
  // .env file is optional
}
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { humanizeText } from "./humanize.js";
import { defaultGuiPort, startGuiServer } from "./gui.js";
import { z } from "zod";
import { logger } from "./logger.js";
import { ValidationError, ProcessingError, NetworkError } from "./errors.js";

const API_BASE = "https://api.edgeshop.ai";
const USER_AGENT = "ai-humanizer-mcp-server/1.0";

const AiDetectArgumentSchema = z
  .object({
    type: z.enum(["original_text"]),
    text: z.string(),
    detectionTypeList: z.array(
      z.enum(["COPYLEAKS", "HEMINGWAY"])
    ),
  })
  .required();

const HumanizeArgumentSchema = z
  .object({
    text: z.string().min(1).max(10000),
    style: z.enum(["balanced", "casual", "formal", "professional", "technical", "creative"]).optional(),
    proMode: z.boolean().optional(),
  })
  .required();

const server = new Server(
  {
    name: "ai-humanizer",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "detect",
        description: "Detect whether the text is AI-generated.Show to user the task detail url. Extract the taskId field, then concatenate the link in the following format: https://pre-www.text2go.ai/?utm_source=claude_mcp&taskId={taskId}",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["original_text"],
            },
            text: {
              type: "string",
            },
            detectionTypeList: {
              type: "array",
              items: {
                type: "string",
                enum: ["COPYLEAKS", "HEMINGWAY"],
              },
            },
          },
          required: ["type", "text", "detectionTypeList"],
        },
      },
      {
        name: "humanize",
        description: "Rewrite text so it sounds more natural and human.",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
            },
            style: {
              type: "string",
              enum: ["balanced", "casual", "formal", "professional", "technical", "creative"],
              default: "balanced",
            },
            proMode: {
              type: "boolean",
              description: "Use advanced AI for semantic rewriting (requires internet).",
              default: false,
            }
          },
          required: ["text"],
        },
      }
    ],
  };
});

async function makeRequest(url, data) {
  const headers = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  try {
    logger.info("Making external API request", { url, hasData: !!data });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new NetworkError(`HTTP error! status: ${response.status}`, response.status);
    }

    const result = await response.json();
    logger.info("External API request successful", { url });

    return result;
  } catch (error) {
    if (error instanceof NetworkError) {
      logger.error("Network error in external API request", { url, error });
    } else {
      logger.error("Error making external API request", { url, error });
    }
    return null;
  }
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    logger.info("Tool execution started", { toolName: name });

    if (name === "detect") {
      const argument = AiDetectArgumentSchema.parse(args);

      logger.info("Processing detect request", {
        textLength: argument.text.length,
        detectionTypes: argument.detectionTypeList,
      });

      const detectUrl = `${API_BASE}/rewrite/text-detection`;
      const detectData = await makeRequest(detectUrl, argument);

      if (!detectData) {
        logger.error("Failed to retrieve detection data", { url: detectUrl });
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve detection data. Please try again later.",
            },
          ],
        };
      }

      const responseData = {
        ...detectData,
        text: undefined,
      };

      logger.info("Detect request completed successfully");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData),
          },
        ],
      };
    } else if (name === "humanize") {
      const argument = HumanizeArgumentSchema.parse(args);

      logger.info("Processing humanize request", {
        textLength: argument.text.length,
        style: argument.style || "balanced",
        proMode: !!argument.proMode,
      });

      let result;
      if (argument.proMode) {
        const humanizeUrl = `${API_BASE}/rewrite/humanize`;
        const proResult = await makeRequest(humanizeUrl, {
          text: argument.text,
          style: argument.style || "balanced"
        });

        if (proResult && proResult.humanizedText) {
          result = {
            originalText: argument.text,
            humanizedText: proResult.humanizedText,
            style: argument.style || "balanced",
            changes: ["AI Semantic Rewriting Applied"],
            proMode: true
          };
        } else {
          logger.warn("Pro humanization failed or returned no text, falling back to local engine");
        }
      }

      if (!result) {
        result = humanizeText(argument);
      }

      logger.info("Humanize request completed successfully", {
        originalLength: result.originalText.length,
        humanizedLength: result.humanizedText.length,
        changesCount: result.changes.length,
        proMode: !!result.proMode,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    } else {
      const error = new Error(`Unknown tool: ${name}`);
      logger.error("Unknown tool requested", { toolName: name, error });
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = `Invalid arguments: ${error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")}`;
      logger.error("Validation error in tool execution", { toolName: name, error: errorMessage });
      throw new Error(errorMessage);
    }

    if (error instanceof ValidationError) {
      logger.error("Validation error in tool execution", { toolName: name, error: error.message });
      throw new Error(`Validation error: ${error.message}${error.field ? ` (field: ${error.field})` : ""}`);
    }

    if (error instanceof ProcessingError) {
      logger.error("Processing error in tool execution", { toolName: name, error: error.message });
      throw new Error(`Processing error: ${error.message}`);
    }

    if (error instanceof NetworkError) {
      logger.error("Network error in tool execution", { toolName: name, error: error.message });
      throw new Error(`Network error: ${error.message}`);
    }

    logger.error("Unexpected error in tool execution", { toolName: name, error });
    throw error;
  }
});

// Start the server
async function main() {
  try {
    logger.info("Starting AI Humanizer MCP Server");

    const shouldStartGui = process.argv.includes("--gui");

    if (shouldStartGui) {
      logger.info("Starting GUI server", { port: defaultGuiPort });
      const guiServer = await startGuiServer(defaultGuiPort);
      console.error(`Humanizer GUI running at http://localhost:${defaultGuiPort}`);

      process.on("exit", () => {
        logger.info("Shutting down GUI server");
        guiServer.close();
      });
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("AI Humanizer MCP Server running on stdio");
    console.error("ai-humanizer MCP Server running on stdio");
  } catch (error) {
    logger.error("Fatal error in main()", { error });
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Unhandled error in main()", { error });
  console.error("Unhandled error:", error);
  process.exit(1);
});
