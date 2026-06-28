/**
 * Profiler Agent Node (Vanilla JS + Hugging Face Integration).
 * 
 * Uses @huggingface/inference client's chatCompletion task
 * to profile input text for AI patterns and generate a directive.
 */

import { HfInference } from "@huggingface/inference";

// ChatHuggingFace wrapper class to route calls through conversational tasks (chatCompletion)
class ChatHuggingFace {
  constructor({ apiKey, model }) {
    this.hf = new HfInference(apiKey);
    this.model = model;
  }

  async invoke(prompt) {
    const response = await this.hf.chatCompletion({
      model: this.model,
      messages: [
        { role: "system", content: "You are a writing analyzer. Generate a short, actionable editing directive to guide a copywriter in humanizing text. Do not output anything other than the directive itself." },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    return response.choices[0].message.content.trim();
  }
}

/**
 * Profiler node function.
 * 
 * @param {Object} state - Plain JS state object
 * @returns {Promise<Object>} State updates (directive)
 */
export async function profilerNode(state) {
  const { rawText } = state;
  const apiKey = process.env.HUGGINGFACEHUB_API_TOKEN;

  if (!rawText) {
    throw new Error("Profiler Node: state.rawText is required.");
  }

  console.log("[Profiler Agent] Profiling text style using Qwen/Qwen2.5-7B-Instruct...");

  const prompt = `Analyze the following text for robotic, predictable, or AI-generated writing traits (such as clichés like 'delve', 'moreover', overly formal transitions, or passive voice). Generate a short, actionable editing directive to guide a writer in humanizing this text.
  
Text to analyze:
"${rawText}"`;

  let directive = "";

  if (!apiKey) {
    console.warn("[Profiler Agent] HUGGINGFACEHUB_API_TOKEN is not set. Using local mock profile rules.");
    // Heuristic rule-based fallback
    const hasCliches = /\b(delve|moreover|testament|furthermore|in order to)\b/i.test(rawText);
    directive = hasCliches 
      ? "Please eliminate AI cliches like 'delve', 'moreover', and simplify wordy transitional structures."
      : "Ensure sentence lengths are varied and transitions are fluid and natural.";
  } else {
    try {
      // Instantiate wrapper lazily inside the node function
      const model = new ChatHuggingFace({
        apiKey: apiKey,
        model: "Qwen/Qwen2.5-7B-Instruct",
      });

      const response = await model.invoke(prompt);
      directive = response;
    } catch (error) {
      console.error("[Profiler Agent] Hugging Face Inference API call failed:", error.message);
      // Fallback in case of server failure
      directive = "The text contains typical AI-associated transition patterns. Simplify syntax and replace stiff connectors.";
    }
  }

  console.log(`[Profiler Agent] Generated Directive: "${directive}"`);

  return {
    directive: directive
  };
}
