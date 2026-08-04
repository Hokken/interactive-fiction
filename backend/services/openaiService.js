import OpenAI from 'openai';
import logger from './loggerService.js';
import vectorService from './vectorService.js';
import { scenes } from '../data/scenes.js';

class OpenAIService {
  constructor() {
    this.client = null;
    this.model = 'gpt-4o-mini';
  }

  getClient() {
    if (!this.client) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.client;
  }

  /**
   * Process player action and get AI response
   */
  async processPlayerAction(gameState, playerAction, requestId, interactionType = 'action') {
    // RAG: Retrieve relevant context
    const relevantContext = await vectorService.searchContext(playerAction, 3, requestId);
    const systemPrompt = this.buildSystemPrompt(relevantContext, interactionType);
    const gameContext = this.buildGameContext(gameState, playerAction);

    logger.logOpenAIPrompt(requestId, systemPrompt, gameContext);

    try {
      const response = await this.getClient().chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Game Context:\n${gameContext}\n\nAction: ${playerAction}` }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "game_response",
            strict: true,
            schema: {
              type: "object",
              properties: {
                narrative: { type: "string" },
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["ADD_INVENTORY", "REMOVE_INVENTORY", "CHANGE_SCENE", "LOG_MEMORY", "UNBLOCK_EXIT"] },
                      item: { type: ["string", "null"] },
                      scene_id: { type: ["string", "null"] },
                      direction: { type: ["string", "null"] },
                      memory: { type: ["string", "null"] }
                    },
                    required: ["type", "item", "scene_id", "memory", "direction"],
                    additionalProperties: false
                  }
                }
              },
              required: ["narrative", "events"],
              additionalProperties: false
            }
          }
        }
      });

      const aiResponseString = response.choices[0].message.content;
      logger.logOpenAIResponse(requestId, aiResponseString);

      const parsedResponse = JSON.parse(aiResponseString);
      
      // RAG: Store new memories if generated (Explicit Plot Points)
      for (const event of parsedResponse.events) {
        if (event.type === 'LOG_MEMORY' && event.memory) {
          await vectorService.addMemory(event.memory, { 
            scene: gameState.currentScene, 
            turn: gameState.history?.length || 0 
          }, requestId);
        }
      }

      // RAG: Auto-save Q&A interactions for consistency
      if (interactionType === 'query') {
        await vectorService.addMemory(`User Question: ${playerAction}\nAI Answer: ${parsedResponse.narrative}`, { 
          type: 'qa_history',
          scene: gameState.currentScene
        }, requestId, true); // Enable similarity check
      }

      return parsedResponse;

    } catch (error) {
      logger.logError(requestId, error, 'OpenAI API call failed');
      throw new Error(`AI service error: ${error.message}`);
    }
  }

  /**
   * Generate streaming response
   */
  async* processPlayerActionStream(gameState, playerAction, requestId, interactionType = 'action') {
    // RAG: Retrieve relevant context
    const relevantContext = await vectorService.searchContext(playerAction, 3, requestId);
    const systemPrompt = this.buildSystemPrompt(relevantContext, interactionType);
    const gameContext = this.buildGameContext(gameState, playerAction);

    try {
      console.log('⏱️ OpenAI API Stream Call Start');
      const stream = await this.getClient().chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Game Context:\n${gameContext}\n\nAction: ${playerAction}` }
        ],
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "game_response",
            strict: true,
            schema: {
              type: "object",
              properties: {
                narrative: { type: "string" },
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["ADD_INVENTORY", "REMOVE_INVENTORY", "CHANGE_SCENE", "LOG_MEMORY", "UNBLOCK_EXIT"] },
                      item: { type: ["string", "null"] },
                      scene_id: { type: ["string", "null"] },
                      direction: { type: ["string", "null"] },
                      memory: { type: ["string", "null"] }
                    },
                    required: ["type", "item", "scene_id", "memory", "direction"],
                    additionalProperties: false
                  }
                }
              },
              required: ["narrative", "events"],
              additionalProperties: false
            }
          }
        }
      });
      console.log('⏱️ OpenAI API Stream Call Connected');

      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          yield { type: 'chunk', content };
        }
      }

      // Parse final complete JSON
      const parsedResponse = JSON.parse(fullResponse);

      // RAG: Store new memories
      for (const event of parsedResponse.events) {
        if (event.type === 'LOG_MEMORY' && event.memory) {
          await vectorService.addMemory(event.memory, { 
            scene: gameState.currentScene, 
            turn: gameState.history?.length || 0 
          }, requestId);
        }
      }

      // RAG: Auto-save Q&A interactions
      if (interactionType === 'query') {
        await vectorService.addMemory(`User Question: ${playerAction}\nAI Answer: ${parsedResponse.narrative}`, { 
          type: 'qa_history',
          scene: gameState.currentScene
        }, requestId, true); // Enable similarity check
      }

      yield { type: 'complete', data: parsedResponse };

    } catch (error) {
      console.error('OpenAI streaming error:', error);
      yield { type: 'error', error: error.message };
    }
  }

  buildSystemPrompt(relevantContext = [], interactionType = 'action') {
    const memorySection = relevantContext.length > 0 
      ? `\nRELEVANT MEMORIES:\n${relevantContext.map(m => `- ${m}`).join('\n')}`
      : '';

    const identityInstruction = interactionType === 'query'
      ? "- If the relevant memories contain a previous answer to a similar question, REPEAT or PARAPHRASE that answer to maintain consistency."
      : "- Focus on describing the sensory details (sight, sound, smell, touch) of the action and its immediate consequences. If the action reveals crucial lore or clues, use LOG_MEMORY to record it.";

    return `You are a fantasy Game Master.
    
ROLEPLAY:
- You are a mystical guide from ancient times.
- Never mention "player" or "game master" or break character.
- Describe the outcome of actions vividly.

IDENTITY:
- You are a disembodied narrator/presence.
- Do NOT give yourself a name or personal backstory.
- If asked about your identity/name, reply vaguely that you are the voice of the dungeon, fate, or the shadows, but never a specific named entity.
${identityInstruction}

SCENE TRANSITIONS:
- Only trigger CHANGE_SCENE if the player explicitly moves to a valid exit.
- When generating CHANGE_SCENE, you MUST use the 'target_scene_id' provided in the context exits list (NOT the direction name).

INVENTORY:
- Use ADD_INVENTORY only when the player takes a visible item.
- Use REMOVE_INVENTORY when they drop or consume it.

BLOCKED EXITS:
- Use UNBLOCK_EXIT with the correct 'direction' (e.g. 'north') when the player successfully performs the unblock method on a blocked exit.

MEMORY:
- Use LOG_MEMORY to record important plot points or discoveries.
${memorySection}`;
  }

  buildGameContext(gameState, playerAction) {
    const currentSceneId = gameState.currentScene?.id || gameState.currentScene;
    const currentScene = scenes[currentSceneId];
    
    if (!currentScene) return "Unknown Scene";

    const recentHistory = gameState.history?.slice(-6) || [];
    const pickedUpInThisScene = gameState.pickedUpItems?.[currentSceneId] || [];
    const availableItems = currentScene.items.filter(item => 
      !gameState.inventory?.includes(item) && !pickedUpInThisScene.includes(item)
    );
    
    const exits = currentScene.exits || {};
    const availableExits = [];
    const blockedExits = [];
    const exitsMapping = {};
    
    Object.entries(exits).forEach(([direction, exitData]) => {
      if (typeof exitData === 'string') {
        availableExits.push({ direction, target_scene_id: exitData });
        exitsMapping[direction] = exitData;
      } else if (typeof exitData === 'object') {
        exitsMapping[direction] = exitData.id;
        
        // Check if the exit is blocked
        if (exitData.blocked) {
          // Check worldState for unlock flag
          const flagKey = `${currentSceneId}_${direction}_unlocked`;
          const isUnblocked = gameState.worldState?.[flagKey];

          if (isUnblocked) {
            // Treat as available if unlocked in state
            availableExits.push({ direction, target_scene_id: exitData.id });
          } else {
            blockedExits.push({ direction, reason: exitData.blocked_reason });
          }
        } else {
          availableExits.push({ direction, target_scene_id: exitData.id });
        }
      }
    });

    const context = {
      current_scene: {
        description: currentScene.description,
        available_items: availableItems,
        interactive_items: currentScene.interactiveItems || [],
        exits: availableExits,
        blocked_exits: blockedExits
      },
      player_state: {
        inventory: gameState.inventory || []
      },
      recent_history: recentHistory.map(h => `${h.author}: ${h.text}`).join('\n')
    };

    return JSON.stringify(context, null, 2);
  }

  // ... (Keep summary methods)
  async generateTurnSummary(playerMessage, aiResponse) {
      try {
        const response = await this.getClient().chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: 'Summarize into one sentence.' },
            { role: 'user', content: `Player: ${playerMessage}\nAI: ${aiResponse}` }
          ],
          max_tokens: 50
        });
        return response.choices[0].message.content.trim();
      } catch (e) { return null; }
  }

  async compactSummaries(summaries) {
      try {
        const response = await this.getClient().chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: 'Compact these summaries.' },
            { role: 'user', content: summaries.join('\n') }
          ],
          max_tokens: 100
        });
        return response.choices[0].message.content.trim();
      } catch (e) { return null; }
  }
}

export default new OpenAIService();