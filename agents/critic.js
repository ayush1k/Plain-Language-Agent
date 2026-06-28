/**
 * Critic Agent Node (Vanilla JS + Hugging Face Integration).
 * 
 * Uses the official @huggingface/inference client to evaluate 
 * the draft text. Throttles graph execution with a 2000ms delay.
 */

import { HfInference } from "@huggingface/inference";

/**
 * Critic node function.
 * 
 * @param {Object} state - Plain JS state object
 * @returns {Promise<Object>} State updates (status, directive)
 */
export async function criticNode(state) {
  const apiKey = process.env.HUGGINGFACEHUB_API_TOKEN;
  // CRUCIAL: Implement a 2000ms asynchronous delay to throttle loop & avoid Hugging Face rate limits
  console.log("[Critic Agent] Throttling loop: sleeping for 2000ms...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const { draftText, directive } = state;
  console.log("[Critic Agent] Evaluating draft quality using Hugging Face Inference API...");

  const prompt = `Evaluate the following text. Determine if it sounds completely natural and human-written (not like AI-generated text).
Look specifically for:
1. AI clichés (e.g. "delve", "moreover", "testament to").
2. Predictable, robotic cadence.

If it sounds natural, respond with exactly: APPROVED.
If it still sounds robotic or has clichés, respond with exactly: REJECTED followed by constructive feedback.

Text:
"${draftText}"

Evaluation (APPROVED or REJECTED [feedback]):`;

  let status = "approved";
  let updatedDirective = directive;

  if (!apiKey) {
    console.warn("[Critic Agent] HUGGINGFACEHUB_API_TOKEN is not set. Using local mock critic rules.");
    // Demo loop logic: If it hasn't been refined, reject it to trigger the loop.
    const hasBeenRefined = directive && directive.includes("Critic feedback");
    if (!hasBeenRefined) {
      status = "rejected";
      updatedDirective = "Critic feedback: The text is improved, but please refine the transitions for a more natural human cadence.";
    } else {
      status = "approved";
    }
  } else {
    try {
      // Instantiate the Hugging Face Inference SDK client lazily
      const hf = new HfInference(apiKey);

      const response = await hf.chatCompletion({
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages: [
          { role: "system", content: "You are a writing critic. Respond with either 'APPROVED' or 'REJECTED: [feedback]'" },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.2,
      });

      const resultText = response.choices[0].message.content.trim();
      console.log(`[Critic Agent] Evaluation Result: ${resultText}`);

      if (resultText.toUpperCase().includes("APPROVED")) {
        status = "approved";
      } else {
        status = "rejected";
        updatedDirective = resultText.replace(/^REJECTED:?/i, "Critic feedback:").trim();
      }
    } catch (error) {
      console.error("[Critic Agent] Hugging Face Inference call failed:", error.message);
      // Fallback: approve if already gone through a loop, else reject once
      const hasBeenRefined = directive && directive.includes("Critic feedback");
      if (!hasBeenRefined) {
        status = "rejected";
        updatedDirective = "Critic feedback: The text is improved, but please refine the transitions for a more natural human cadence.";
      } else {
        status = "approved";
      }
    }
  }

  console.log(`[Critic Agent] Evaluation complete. Status: ${status}`);

  return {
    status: status,
    directive: updatedDirective
  };
}
