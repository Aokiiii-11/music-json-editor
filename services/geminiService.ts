import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { ApiSettings, ApiProvider } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const callCustomApi = async (prompt: string, settings: ApiSettings): Promise<string> => {
  const { customUrl, customMethod, customHeaders, customBodyTemplate, customResponsePath } = settings;
  
  // 1. Prepare Headers
  let headers = {};
  const trimmedHeaders = customHeaders.trim();
  if (trimmedHeaders) {
    try {
      headers = JSON.parse(trimmedHeaders);
    } catch (e) {
      // If parsing fails but it's empty string, fine. If not empty, throw.
      if (trimmedHeaders.length > 0) {
        throw new Error(`Invalid Custom Headers format. Must be valid JSON. Error: ${(e as Error).message}`);
      }
    }
  }

  // 2. Prepare Body
  const escapedPrompt = JSON.stringify(prompt); 
  
  let bodyStr = customBodyTemplate;
  
  if (bodyStr.includes('"{{prompt}}"')) {
     bodyStr = bodyStr.replace('"{{prompt}}"', escapedPrompt);
  } else {
     bodyStr = bodyStr.replace('{{prompt}}', escapedPrompt);
  }

  // DEBUG LOGGING
  console.log("%c[CustomAPI] Request:", "color: #8b5cf6; font-weight: bold;");
  console.log("URL:", customUrl);
  console.log("Method:", customMethod);
  console.log("Headers:", headers);
  console.log("Body:", bodyStr);

  // 3. Fetch
  let response;
  try {
    response = await fetch(customUrl, {
      method: customMethod,
      headers: headers,
      body: customMethod === 'POST' ? bodyStr : undefined,
    });
  } catch (netErr) {
     throw new Error(`Network request failed: ${(netErr as Error).message}. Check URL and CORS settings.`);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("[CustomAPI] Error Response:", errText);
    throw new Error(`Custom API Error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  console.log("[CustomAPI] Success Response:", json);
  
  // 4. Extract Response
  const resultText = getNestedValue(json, customResponsePath);
  
  if (typeof resultText !== 'string') {
    console.warn("Full API Response:", json);
    console.warn("Failed Path:", customResponsePath);
    throw new Error(`Could not find text at path '${customResponsePath}'. See console for full response.`);
  }

  return resultText;
};

export const translateJson = async (jsonData: any, customPrompt?: string, apiSettings?: ApiSettings): Promise<any> => {
  const modelId = 'gemini-3-pro-preview';
  
  const defaultSystemInstruction = `
    你是翻译专家，并且是音乐爱好者，你会讲输入的各个国家的语言、音乐描述、术语、歌词等音乐信息准确的翻译成中文。
    
    RULES:
    1. Keep the JSON structure exactly the same. Do not change keys.
    2. For every string value that is English text, translate it to Chinese.
    3. Format the final value as "Original English Value | Chinese Translation".
    4. If the value is empty, keep it empty.
    5. If the value is a number or technical ID (like UUID), keep it as is.
    6. Ensure music terminology is accurate (e.g., "Verse", "Chorus", "BPM", "Chord Progression").
    
    Example:
    Input: { "description": "High energy rock song" }
    Output: { "description": "High energy rock song | 高能量摇滚歌曲" }
  `;

  const systemInstruction = customPrompt || defaultSystemInstruction;

  // Minify JSON
  const jsonString = JSON.stringify(jsonData);
  
  // Construct the full prompt content
  const fullPromptForCustom = `${systemInstruction}\n\nTask: Please translate the following JSON:\n\n\`\`\`json\n${jsonString}\n\`\`\``;
  const geminiUserPrompt = `Please translate the following JSON:\n\n\`\`\`json\n${jsonString}\n\`\`\``;

  let lastError;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let text = "";

      if (apiSettings && apiSettings.provider === ApiProvider.CUSTOM) {
        text = await callCustomApi(fullPromptForCustom, apiSettings);
      } else {
        // Default Gemini
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: modelId,
          contents: geminiUserPrompt,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
          }
        });
        text = response.text || "";
      }

      if (!text) throw new Error("No response text received");

      // Robust JSON Extraction
      let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      
      const firstBrace = cleanText.indexOf('{');
      const firstBracket = cleanText.indexOf('[');
      const startIdx = (firstBrace === -1) ? firstBracket : (firstBracket === -1) ? firstBrace : Math.min(firstBrace, firstBracket);
      
      if (startIdx !== -1) {
          cleanText = cleanText.substring(startIdx);
          const lastBrace = cleanText.lastIndexOf('}');
          const lastBracket = cleanText.lastIndexOf(']');
          const endIdx = Math.max(lastBrace, lastBracket);
          if (endIdx !== -1) {
             cleanText = cleanText.substring(0, endIdx + 1);
          }
      }

      return JSON.parse(cleanText);

    } catch (error: any) {
      console.warn(`Translation attempt ${attempt} failed:`, error);
      lastError = error;
      if (attempt === maxRetries) break;
      await delay(1000 * Math.pow(2, attempt));
    }
  }
  
  throw lastError || new Error("Translation failed after multiple attempts");
};

export const createChatSession = (contextData?: any): Chat => {
  const contextString = contextData ? JSON.stringify(contextData).substring(0, 10000) : "No specific file loaded.";
  
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `You are an intelligent assistant for a Music JSON Translation tool. 
      Users are editing a JSON file containing music analysis data.
      
      Current File Context (Truncated):
      ${contextString}
      
      Help the user with:
      1. Explaining music terminology (BPM, Timbre, Chord Progressions).
      2. Suggesting better translations for specific terms.
      3. Validating the JSON structure.
      `,
    },
  });
};

export const sendMessage = async (chat: Chat, message: string): Promise<string> => {
  const response: GenerateContentResponse = await chat.sendMessage({ message });
  return response.text || "I couldn't generate a response.";
};