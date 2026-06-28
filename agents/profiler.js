import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { calculateReadabilityMetrics } from "../src/readability.js";

/**
 * Profiler agent node using Gemini to analyze complexity and set a directive.
 * 
 * @param {Object} state - State object
 * @returns {Promise<Object>} State updates
 */
export async function profilerNode(state) {
  const { rawText, gradeLevel = "8" } = state;

  if (!rawText) {
    throw new Error("Profiler Node: state.rawText is required.");
  }

  // Step one: compute the Flesch-Kincaid grade level
  const metrics = calculateReadabilityMetrics(rawText);
  const beforeScore = metrics.fleschKincaidGrade;

  console.error(`[Profiler Agent] Computed initial Flesch-Kincaid Grade Level: ${beforeScore.toFixed(2)}`);

  const systemPrompt = `You are a plain language compliance analyst.
Analyze the provided text and identify:
1. The approximate reading difficulty.
2. Any sentences over 25 words.
3. Passive voice constructions.
4. Jargon or technical vocabulary.
5. Nominalization patterns (verbs turned into nouns, e.g., "utilization" instead of "use", "implementation" instead of "do").

The target readability level is Flesch-Kincaid Grade Level ${gradeLevel}.
Based on this target and your analysis, produce a structured editing directive for the Paraphraser agent detailing exactly what needs to be simplified and how. Keep your directive direct, concise, and actionable. Do not output anything other than the directive itself.`;

  let directive = "";
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey || apiKey === "your_google_api_key_here") {
    console.error("[Profiler Agent] GOOGLE_API_KEY is not set or placeholder. Using local fallback mock directive.");
    directive = `Rewrite the text to target Grade ${gradeLevel} readability. Simplify vocabulary, break down sentences longer than 25 words, and convert passive voice to active voice.`;
  } else {
    try {
      console.error("[Profiler Agent] Profiling text style using Gemini (gemini-2.5-flash)...");

      // Step two: lazily instantiate ChatGoogleGenerativeAI inside function body
      const model = new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: "gemini-2.5-flash",
        temperature: 0.3,
      });

      // Step three: call Gemini with system message and user input
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(rawText)
      ]);

      directive = typeof response.content === "string" ? response.content.trim() : JSON.stringify(response.content);
    } catch (error) {
      console.error("[Profiler Agent] Gemini API call failed:", error.message);
      directive = `Rewrite the text to target Grade ${gradeLevel} readability. Simplify vocabulary, break down sentences longer than 25 words, and convert passive voice to active voice.`;
    }
  }

  console.error(`[Profiler Agent] Generated Directive: "${directive}"`);

  // Step four: return state update object
  return {
    directive,
    readabilityScores: {
      before: beforeScore,
      after: null
    },
    gradeLevel
  };
}
