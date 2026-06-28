import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { calculateReadabilityMetrics } from "../src/readability.js";

/**
 * Critic agent node using Gemini to evaluate plain language compliance.
 * Includes a hard Flesch-Kincaid score gate and a 2000ms throttle delay.
 * 
 * @param {Object} state - State object
 * @returns {Promise<Object>} State updates
 */
export async function criticNode(state) {
  const { draftText, gradeLevel = "8", directive, readabilityScores } = state;

  if (!draftText) {
    throw new Error("Critic Node: state.draftText is required.");
  }

  // Step one: add 2000ms delay to prevent rate limit issues
  console.error("[Critic Agent] Throttling loop: sleeping for 2000ms...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step two: compute the Flesch-Kincaid grade level
  const metrics = calculateReadabilityMetrics(draftText);
  const afterScore = metrics.fleschKincaidGrade;

  const updatedReadabilityScores = {
    before: readabilityScores ? readabilityScores.before : null,
    after: afterScore
  };

  console.error(`[Critic Agent] Computed draft Flesch-Kincaid Grade Level: ${afterScore.toFixed(2)} (Target: ${gradeLevel})`);

  // Step three — score gate
  if (afterScore <= Number(gradeLevel)) {
    console.error(`[Critic Agent] Score gate passed. Readability level ${afterScore.toFixed(2)} is at or below target ${gradeLevel}. Approving.`);
    return {
      status: "approved",
      directive,
      readabilityScores: updatedReadabilityScores
    };
  }

  // Step four — Gemini review (only reached if score gate failed)
  const systemPrompt = `You are a plain language compliance reviewer.
Analyze the provided draft text to determine if it meets the plain language guidelines for target Flesch-Kincaid Grade Level ${gradeLevel}.
Specifically, check if there is any remaining complex jargon, sentences over 25 words, or passive voice constructions.

If the text is acceptably simple, clear, and compliant, respond with exactly: APPROVED
If the text still contains jargon, overly long sentences, or passive voice, respond with exactly: REJECTED: followed by one specific sentence describing what needs to change.

Do not output any additional commentary.`;

  let status = "approved";
  let updatedDirective = directive;
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey || apiKey === "your_google_api_key_here") {
    console.error("[Critic Agent] GOOGLE_API_KEY is not set or placeholder. Using local fallback mock critic rules.");
    // Fallback loop logic: Reject once to demonstrate/test loop correction
    const hasBeenRefined = directive && directive.includes("Critic feedback");
    if (!hasBeenRefined) {
      status = "rejected";
      updatedDirective = `${directive} Critic feedback: Please simplify the vocabulary further and reduce sentence lengths.`;
    } else {
      status = "approved";
    }
  } else {
    try {
      console.error("[Critic Agent] Evaluating plain language compliance using Gemini (gemini-2.5-flash)...");

      // Lazily instantiate model in function context
      const model = new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: "gemini-2.5-flash",
        temperature: 0.1,
      });

      // Call Gemini with system prompt and draft text
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(draftText)
      ]);

      const resultText = typeof response.content === "string" ? response.content.trim() : "";
      console.error(`[Critic Agent] Gemini Evaluation Result: ${resultText}`);

      // Step five: parse response
      if (resultText.toUpperCase().startsWith("APPROVED")) {
        status = "approved";
      } else if (resultText.toUpperCase().startsWith("REJECTED")) {
        status = "rejected";
        const feedback = resultText.replace(/^REJECTED:?/i, "").trim();
        updatedDirective = `${directive} Critic feedback: ${feedback}`;
      } else {
        status = "approved";
      }
    } catch (error) {
      console.error("[Critic Agent] Gemini API call failed:", error.message);
      // Fallback in case of API failure
      const hasBeenRefined = directive && directive.includes("Critic feedback");
      if (!hasBeenRefined) {
        status = "rejected";
        updatedDirective = `${directive} Critic feedback: Please simplify the vocabulary further and reduce sentence lengths.`;
      } else {
        status = "approved";
      }
    }
  }

  console.error(`[Critic Agent] Evaluation complete. Status: ${status}`);

  return {
    status,
    directive: updatedDirective,
    readabilityScores: updatedReadabilityScores
  };
}
