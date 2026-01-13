/**
 * Anthropic Claude API Client
 * 
 * Week 3: AI Infrastructure
 * Core integration with Anthropic's Claude API for task generation
 */

import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client (lazy initialization)
let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. " +
        "Add it to .env.local for development or Vercel environment variables for production."
      );
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// Default model for task generation
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";
export const DEFAULT_MAX_TOKENS = 4096;

// Type definitions for structured task generation
export interface GeneratedTask {
  title: string;
  description: string;
  domain: "MECHANICAL" | "ELECTRICAL" | "CONTROLS" | "INSTRUMENTATION" | "UNIFIED";
  sequenceNumber: number;
  isCritical: boolean;
  requiresEvidence: boolean;
  estimatedMinutes?: number;
  measurements?: Array<{
    name: string;
    unit?: string;
    measurementType: "NUMERIC" | "PASS_FAIL" | "TEXT";
    minValue?: number;
    maxValue?: number;
  }>;
}

export interface AITaskGenerationRequest {
  workOrderContext: {
    title: string;
    description?: string;
    orderType: string;
    assetInfo?: {
      name: string;
      category?: string;
      family?: string;
      subFamily?: string;
      manufacturer?: string;
      model?: string;
    };
    customerInfo?: {
      name: string;
      siteName?: string;
    };
  };
  procedureContext?: {
    templates: Array<{
      name: string;
      description?: string;
      context: string;
      steps: Array<{
        title: string;
        description?: string;
        domain?: string;
        isCritical: boolean;
        estimatedMinutes?: number;
      }>;
    }>;
  };
  userInstructions?: string;
}

export interface AITaskGenerationResponse {
  tasks: GeneratedTask[];
  summary: string;
  estimatedTotalDuration: number; // minutes
  tokensUsed: number;
  durationMs: number;
}

/**
 * Generate tasks using Claude API with structured output
 */
export async function generateTasksWithClaude(
  request: AITaskGenerationRequest,
  options: {
    model?: string;
    maxTokens?: number;
  } = {}
): Promise<AITaskGenerationResponse> {
  const startTime = Date.now();
  const client = getAnthropicClient();

  // Build prompt
  const prompt = buildTaskGenerationPrompt(request);

  // Call Claude API
  const response = await client.messages.create({
    model: options.model || DEFAULT_MODEL,
    max_tokens: options.maxTokens || DEFAULT_MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    system: SYSTEM_PROMPT_TASK_GENERATION,
  });

  // Extract text response
  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  // Parse structured output
  const parsed = parseTaskGenerationResponse(textContent.text);

  const durationMs = Date.now() - startTime;

  return {
    tasks: parsed.tasks,
    summary: parsed.summary,
    estimatedTotalDuration: parsed.tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0),
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    durationMs,
  };
}

/**
 * System prompt for task generation
 */
const SYSTEM_PROMPT_TASK_GENERATION = `You are an expert service technician and work planner specializing in rotating equipment (pumps, motors, gearboxes) and industrial controls.

Your role is to generate detailed, standards-driven task lists for service work orders. You understand:
- Industry standards: HI (Hydraulic Institute), API 610, ESA (Electrical Safety Authority), NEC (National Electrical Code), UL508A
- Equipment types: Submersible pumps, vertical turbine pumps, split case pumps, end suction pumps, TEFC motors, explosion-proof motors, VFD starters, soft starters, control panels
- Service contexts: REPAIR, STARTUP, PREVENTIVE_MAINTENANCE, INSTALL, INSPECTION, TROUBLESHOOTING

Generate task lists that are:
1. **Sequenced properly** - Safety first, then inspection, then work, then testing
2. **Domain-specific** - Tag tasks as MECHANICAL, ELECTRICAL, CONTROLS, or INSTRUMENTATION
3. **Critical-aware** - Mark safety-critical steps (lockout/tagout, grounding, pressure release)
4. **Evidence-driven** - Require photos/measurements for critical checkpoints
5. **Time-estimated** - Provide realistic time estimates per task

Output Format:
Return ONLY valid JSON with this structure:
{
  "summary": "Brief overview of the work scope",
  "tasks": [
    {
      "title": "Task name",
      "description": "Detailed instructions",
      "domain": "MECHANICAL|ELECTRICAL|CONTROLS|INSTRUMENTATION|UNIFIED",
      "sequenceNumber": 1,
      "isCritical": false,
      "requiresEvidence": false,
      "estimatedMinutes": 30,
      "measurements": [
        {
          "name": "Voltage L1-L2",
          "unit": "V",
          "measurementType": "NUMERIC",
          "minValue": 460,
          "maxValue": 480
        }
      ]
    }
  ]
}

Do NOT include any markdown formatting, explanations, or text outside the JSON object.`;

/**
 * Build prompt for task generation
 */
function buildTaskGenerationPrompt(request: AITaskGenerationRequest): string {
  let prompt = `Generate a detailed task list for the following service work order:\n\n`;

  // Work order context
  prompt += `**Work Order:**\n`;
  prompt += `- Title: ${request.workOrderContext.title}\n`;
  if (request.workOrderContext.description) {
    prompt += `- Description: ${request.workOrderContext.description}\n`;
  }
  prompt += `- Order Type: ${request.workOrderContext.orderType}\n\n`;

  // Asset context
  if (request.workOrderContext.assetInfo) {
    const asset = request.workOrderContext.assetInfo;
    prompt += `**Asset:**\n`;
    prompt += `- Name: ${asset.name}\n`;
    if (asset.category) prompt += `- Category: ${asset.category}\n`;
    if (asset.family) prompt += `- Family: ${asset.family}\n`;
    if (asset.subFamily) prompt += `- Sub-Family: ${asset.subFamily}\n`;
    if (asset.manufacturer) prompt += `- Manufacturer: ${asset.manufacturer}\n`;
    if (asset.model) prompt += `- Model: ${asset.model}\n`;
    prompt += `\n`;
  }

  // Customer context
  if (request.workOrderContext.customerInfo) {
    const customer = request.workOrderContext.customerInfo;
    prompt += `**Customer:**\n`;
    prompt += `- Name: ${customer.name}\n`;
    if (customer.siteName) prompt += `- Site: ${customer.siteName}\n`;
    prompt += `\n`;
  }

  // Procedure template context
  if (request.procedureContext?.templates && request.procedureContext.templates.length > 0) {
    prompt += `**Available Procedure Templates (use as reference):**\n\n`;
    
    for (const template of request.procedureContext.templates) {
      prompt += `Template: "${template.name}"\n`;
      if (template.description) {
        prompt += `Description: ${template.description}\n`;
      }
      prompt += `Context: ${template.context}\n`;
      prompt += `Steps:\n`;
      
      for (let i = 0; i < template.steps.length; i++) {
        const step = template.steps[i];
        prompt += `  ${i + 1}. ${step.title}`;
        if (step.domain) prompt += ` [${step.domain}]`;
        if (step.isCritical) prompt += ` [CRITICAL]`;
        if (step.estimatedMinutes) prompt += ` (~${step.estimatedMinutes} min)`;
        prompt += `\n`;
        if (step.description) {
          prompt += `     ${step.description}\n`;
        }
      }
      prompt += `\n`;
    }
    
    prompt += `Use these templates as a starting point, but adapt the tasks to match the specific work order requirements. You may add, remove, or modify steps as needed.\n\n`;
  }

  // User instructions
  if (request.userInstructions) {
    prompt += `**Additional Instructions:**\n${request.userInstructions}\n\n`;
  }

  prompt += `Generate the task list now. Return ONLY the JSON object, no other text.`;

  return prompt;
}

/**
 * Parse Claude's response into structured task data
 */
function parseTaskGenerationResponse(text: string): {
  tasks: GeneratedTask[];
  summary: string;
} {
  // Remove markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Parse JSON
  try {
    const parsed = JSON.parse(cleaned);
    return {
      tasks: parsed.tasks || [],
      summary: parsed.summary || "AI-generated task list",
    };
  } catch (error) {
    throw new Error(`Failed to parse Claude response as JSON: ${error}`);
  }
}
