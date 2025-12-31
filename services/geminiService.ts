import { GoogleGenAI } from "@google/genai";
import { LogEntry } from "../types";
import { buildArchitectureAdviceSystemInstruction, formatRecentLogs } from "./geminiPrompts";

// Initialize the Gemini client
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing. Chat functionality will be simulated or fail.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const streamArchitectureAdvice = async (
  question: string,
  contextLogs: LogEntry[],
  onChunk: (text: string) => void
) => {
  const client = getClient();
  
  // Fallback for demo if no API key is present
  if (!client) {
    const mockResponse = "I am the ForgeLoop Architect. Please configure your API_KEY to enable live reasoning. Based on the logs, I appear to be fixing a visual regression in the navigation component.";
    let buffer = "";
    for (const char of mockResponse) {
      buffer += char;
      onChunk(buffer);
      await new Promise(r => setTimeout(r, 20));
    }
    return;
  }

  // Construct context from logs
  const recentLogs = formatRecentLogs(contextLogs, 20);
  const systemInstruction = buildArchitectureAdviceSystemInstruction({ recentLogs });

  try {
    const chat = client.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction,
      },
    });

    const result = await chat.sendMessageStream({ message: question });

    let fullText = "";
    for await (const chunk of result) {
      if (chunk.text) {
        fullText += chunk.text;
        onChunk(fullText);
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    onChunk("Error: Unable to contact the neural core. Please check API configuration.");
  }
};