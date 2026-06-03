import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CompareAiConfig, CompareAiProvider } from "@/lib/ai/compare/types";

export function createGeminiProvider(config: CompareAiConfig): CompareAiProvider {
  const client = new GoogleGenerativeAI(config.apiKey);

  return {
    async generateJson(systemPrompt: string, userPrompt: string): Promise<string> {
      const model = client.getGenerativeModel({
        model: config.model,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });
      const result = await model.generateContent(userPrompt);
      const text = result.response.text();
      if (!text?.trim()) {
        throw new Error("Empty response from Gemini.");
      }
      return text;
    },
  };
}
