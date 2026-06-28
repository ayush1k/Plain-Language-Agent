import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import patterns from "../src/patterns.js";

// Initialize the local Model Context Protocol (MCP) server
const server = new Server(
  {
    name: "local-humanizer-patterns-mcp-server",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {}, // Enable tools capability
    },
  }
);

// Define strict Zod schema for the get_plain_language_patterns tool inputs
const GetPatternsInputSchema = z.object({
  gradeLevel: z.enum(["6", "8", "10"], {
    required_error: "gradeLevel parameter is required",
    invalid_type_error: "gradeLevel must be one of '6', '8', or '10'"
  })
}).strict();

// Define tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_plain_language_patterns",
        description: "Retrieves plain language replacement patterns for a target readability grade level, sourced from documented plain language guidelines.",
        inputSchema: {
          type: "object",
          properties: {
            gradeLevel: {
              type: "string",
              description: "Target Flesch-Kincaid grade level. Use 6 for healthcare and children's content, 8 for general public and government content, 10 for legal and technical professional content.",
              enum: ["6", "8", "10"]
            }
          },
          required: ["gradeLevel"]
        }
      }
    ]
  };
});

// Handle tool executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_plain_language_patterns") {
    try {
      // Validate the incoming JSON-RPC arguments using Zod
      const parsedArgs = GetPatternsInputSchema.parse(args);
      const gradeLevel = parsedArgs.gradeLevel;

      console.error(`[MCP Server] Fetching patterns for gradeLevel: ${gradeLevel}`);
      
      // Get the actual pattern objects from patterns.js
      const rawPatterns = patterns[`grade${gradeLevel}`];
      
      // Convert RegExp objects to clean source strings so they can be JSON-serialized properly
      const results = rawPatterns.map((p) => ({
        find: p.pattern ? p.pattern.source : "",
        replace: p.replacement,
        description: p.context ? `Style context: ${p.context}` : "Common replacement"
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`[MCP Server] Argument validation failed: ${error.message}`);
        const validationErrorDetails = error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        
        // Return instructions teaching the calling agent how to correct its query
        return {
          content: [
            {
              type: "text",
              text: `Error: Invalid tool arguments. Details: ${validationErrorDetails}. Please call this tool again and make sure to include the required 'gradeLevel' parameter string set to '6', '8', or '10'.`,
            },
          ],
        };
      }
      throw error;
    }
  } else {
    throw new Error(`Tool not found: ${name}`);
  }
});

// Bootstrap the server using the Stdio transport
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[MCP Server] Local MCP server running on stdio");
  } catch (error) {
    console.error("[MCP Server] Fatal startup error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[MCP Server] Unhandled process error:", error);
  process.exit(1);
});
