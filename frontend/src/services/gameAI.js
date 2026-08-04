import { scenes, generalRules } from '../game/scenes';
import backendAPI from './backendAPI.js';

/*
 * AI SERVICE CONFIGURATION
 * 
 * This service now uses the backend API for all AI interactions.
 * The backend handles:
 * - Request validation using Anthropic Haiku
 * - OpenAI integration with proper JSON validation
 * - Streaming responses
 * 
 * BACKEND CONFIGURATION:
 * 1. Set VITE_BACKEND_URL in your .env file (defaults to http://localhost:3001)
 * 2. Ensure backend server is running with proper API keys
 */

class GameAIService {
  constructor() {
    this.backendAPI = backendAPI;
  }

  // Simple console logging
  log(message, ...args) {
    console.log(message, ...args);
  }


  async processPlayerAction(gameState, playerAction) {
    // Use backend API instead of direct OpenAI calls
    return await this.backendAPI.processPlayerAction(gameState, playerAction);
  }

  /**
   * Process player action with streaming response
   * @param {Object} gameState - Current game state
   * @param {string} playerAction - Player's action
   * @param {Function} onChunk - Callback for each streaming chunk
   * @param {Function} onComplete - Callback when response is complete
   * @param {Function} onError - Callback for errors
   */
  async processPlayerActionStream(gameState, playerAction, onChunk, onComplete, onError) {
    return await this.backendAPI.processPlayerActionStream(
      gameState, 
      playerAction, 
      onChunk, 
      onComplete, 
      onError
    );
  }


  async generateTurnSummary(playerMessage, aiResponse) {
    // Use backend API instead of direct OpenAI calls
    return await this.backendAPI.generateTurnSummary(playerMessage, aiResponse);
  }

  async compactSummaries(summaries) {
    // Use backend API instead of direct OpenAI calls
    return await this.backendAPI.compactSummaries(summaries);
  }

  async summarizeHistory(history) {
    if (history.length < 10) {
      return null; // Don't summarize short histories
    }

    // For now, use the compactSummaries method as a fallback
    // since summarizeHistory is less commonly used
    const summaries = history.map(h => `${h.author}: ${h.text}`);
    return await this.backendAPI.compactSummaries(summaries);
  }
}

export default new GameAIService();