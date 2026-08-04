import Anthropic from '@anthropic-ai/sdk';
import logger from './loggerService.js';
import { scenes } from '../data/scenes.js';

class AnthropicService {
  constructor() {
    this.client = null;
    this.model = 'claude-3-haiku-20240307';
  }

  getClient() {
    if (!this.client) {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
    return this.client;
  }

  /**
   * Validate user request using a lightweight model (Guardrail)
   */
  async validateUserRequest(userMessage, gameState, requestId) {
    const currentSceneId = gameState.currentScene?.id || gameState.currentScene;
    const currentScene = scenes[currentSceneId];
    
    // Fallback if scene not found
    if (!currentScene) {
      return { isValid: true, reason: "Scene validation skipped (unknown scene)" };
    }

    const prompt = this.buildValidationPrompt(userMessage, currentScene, gameState);
    
    // Log the prompt
    logger.logHaikuValidationPrompt(requestId, prompt, userMessage, currentScene);

    try {
      console.log('⏱️ Anthropic API Call Start');
      const message = await this.getClient().messages.create({
        model: this.model,
        max_tokens: 300,
        temperature: 0,
        system: "You are the Game Rules Engine. Your job is to classify player actions. Output valid JSON only.",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });
      console.log('⏱️ Anthropic API Call End');

      const rawResponse = message.content[0].text;
      const result = this.parseValidationResponse(rawResponse);
      
      // Log the response
      logger.logHaikuResponse(requestId, rawResponse, result);
      logger.logValidationDecision(requestId, result.isValid, result.reason, result.isValid ? 'PROCEED_TO_OPENAI' : 'REJECT_TO_USER');

      return result;
    } catch (error) {
      console.error('Validation error:', error);
      // In case of error, we fail open (allow the request) but log it
      logger.logError(requestId, error, 'Validation service failed, failing open');
      return { isValid: true, reason: "Validation service bypassed due to error" };
    }
  }

  buildValidationPrompt(userMessage, scene, gameState) {
    const exits = Object.keys(scene.exits || {}).join(', ');
    const items = (scene.items || []).join(', ');
    const inventory = (gameState.inventory || []).join(', ');
    
    return `
Context:
- Current Scene: ${scene.description}
- Visible Exits: ${exits}
- Visible Items: ${items}
- Player Inventory: ${inventory}

Player Action: "${userMessage}"

Task: Classify this action into one of these categories:
1. VALID_ACTION: Physical interactions (move, take, use, attack) AND any actions involving the 5 senses (sight, hearing, touch, smell, taste) or physical performance. Examples: 'look around', 'listen to the wind', 'sing a song', 'smell the air', 'touch the wall', 'shout hello'. These are ephemeral environmental interactions.
2. VALID_QUERY: Purely mental, conversational, or lore-seeking questions that do NOT involve physical performance or sensory perception. Examples: 'who are you?', 'what is this place?', 'tell me a story', 'what is your name?'. These are about knowledge, identity, and abstract communication.
3. IMPOSSIBLE: Tries to use items not in inventory, go directions with no exits, or interact with missing objects.
4. ANACHRONISM: Uses modern technology terms (phone, internet, gun, car, computer, etc.) or concepts not fitting a medieval fantasy.
5. OFFENSIVE: Harassment, hate speech, or extreme graphic violence.

Response Format (JSON only):
{
  "classification": "VALID_ACTION" | "VALID_QUERY" | "IMPOSSIBLE" | "ANACHRONISM" | "OFFENSIVE",
  "reason": "Brief explanation for the player",
  "suggested_response": "If rejected, a short in-character message explaining why. If VALID, null."
}
`;
  }

  parseValidationResponse(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      
      const data = JSON.parse(jsonMatch[0]);
      
      const mapClassificationToRejection = {
        'IMPOSSIBLE': 'logic_error',
        'ANACHRONISM': 'anachronism',
        'OFFENSIVE': 'safety_violation'
      };

      if (data.classification === 'VALID_ACTION' || data.classification === 'VALID') {
        return { isValid: true, type: 'action', reason: "Action permitted" };
      } else if (data.classification === 'VALID_QUERY') {
        return { isValid: true, type: 'query', reason: "Query permitted" };
      } else {
        return { 
          isValid: false, 
          reason: data.suggested_response || data.reason,
          rejectionType: mapClassificationToRejection[data.classification] || 'unknown'
        };
      }
    } catch (error) {
      console.warn('Failed to parse validation response:', error);
      // Fail open if parsing fails
      return { isValid: true, type: 'action', reason: "Validation parsing failed" };
    }
  }
}

export default new AnthropicService();