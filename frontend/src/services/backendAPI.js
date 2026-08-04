/**
 * Backend API Service
 * Handles communication with the Express backend server
 */

class BackendAPIService {
  constructor() {
    this.baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    this.sessionId = localStorage.getItem('game_session_id');
  }

  // Simple console logging
  log(message, ...args) {
    if (import.meta.env.DEV) {
      console.log(message, ...args);
    }
  }

  setSessionId(id) {
    if (id && id !== this.sessionId) {
      this.sessionId = id;
      localStorage.setItem('game_session_id', id);
      this.log('💾 Session ID saved:', id);
    }
  }

  clearSession() {
    this.sessionId = null;
    localStorage.removeItem('game_session_id');
    this.log('🧹 Session cleared');
  }

  /**
   * Process player action through the backend
   * @param {Object} gameState - Current game state (Ignored by backend now, but kept for signature)
   * @param {string} playerAction - Player's action
   * @returns {Promise<Object>} AI response with narrative and events
   */
  async processPlayerAction(gameState, playerAction) {
    this.log('\n🎮 =============== BACKEND API CALL START ===============');
    this.log('📝 Player Action:', playerAction);
    this.log('🔑 Session ID:', this.sessionId);

    try {
      const response = await fetch(`${this.baseUrl}/api/game/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerAction,
          sessionId: this.sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // LOG: Response from backend
      this.log('\n🌐 BACKEND RESPONSE:');
      this.log('=' + '='.repeat(60));
      this.log(JSON.stringify(data, null, 2));
      this.log('=' + '='.repeat(60));

      // Save Session ID
      if (data.sessionId) {
        this.setSessionId(data.sessionId);
      }

      // Validate the response structure
      if (!data.narrative) {
        throw new Error('Invalid backend response: missing narrative');
      }

      // Ensure events is an array
      if (!Array.isArray(data.events)) {
        data.events = [];
      }

      // LOG: Events analysis
      this.log('\n🎭 EVENTS ANALYSIS:');
      this.log('Total events:', data.events.length);
      data.events.forEach((event, idx) => {
        this.log(`Event ${idx + 1}:`, event);
        if (event.type === 'CHANGE_SCENE') {
          this.log('🚨 SCENE CHANGE DETECTED! New scene:', event.scene_id);
        }
        if (event.type === 'ADD_INVENTORY') {
          this.log('🎒 INVENTORY ADD:', event.item);
        }
      });

      this.log('🎮 =============== BACKEND API CALL END ===============\n');

      return data;

    } catch (error) {
      this.log('❌ Backend API error:', error);
      throw error;
    }
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
    this.log('\n🎮 =============== STREAMING API CALL START ===============');
    this.log('📝 Player Action:', playerAction);
    this.log('🔑 Session ID:', this.sessionId);

    try {
      const response = await fetch(`${this.baseUrl}/api/game/action/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerAction,
          sessionId: this.sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        // Stream: true is important for multi-byte characters
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        let eolIndex;
        while ((eolIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, eolIndex).trim();
          buffer = buffer.slice(eolIndex + 1);

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                onChunk && onChunk(data.content);
              } else if (data.type === 'complete') {
                this.log('🌐 Streaming complete:', data.data);
                this.log('📊 HISTORY RECEIVED:', data.data.gameState?.history?.length);
                
                if (data.data.sessionId) {
                  this.setSessionId(data.data.sessionId);
                }
                
                onComplete && onComplete(data.data);
              } else if (data.type === 'error') {
                onError && onError(new Error(data.error));
              } else if (data.type === 'validating' || data.type === 'validated') {
                this.log('📋', data.message);
              }
            } catch (parseError) {
              this.log('⚠️ Failed to parse streaming data:', line);
            }
          }
        }
      }

      this.log('🎮 =============== STREAMING API CALL END ===============\n');

    } catch (error) {
      this.log('❌ Streaming API error:', error);
      onError && onError(error);
    }
  }

  /**
   * Generate turn summary
   * @param {string} playerMessage - Player's message
   * @param {string} aiResponse - AI's response narrative
   * @returns {Promise<string|null>} Summary or null if failed
   */
  async generateTurnSummary(playerMessage, aiResponse) {
    try {
      const response = await fetch(`${this.baseUrl}/api/game/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerMessage,
          aiResponse
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.summary;

    } catch (error) {
      this.log('❌ Failed to generate turn summary:', error);
      return null;
    }
  }

  /**
   * Compact multiple summaries
   * @param {string[]} summaries - Array of summary strings
   * @returns {Promise<string|null>} Compacted summary or null if failed
   */
  async compactSummaries(summaries) {
    try {
      const response = await fetch(`${this.baseUrl}/api/game/compact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summaries
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.compactedSummary;

    } catch (error) {
      this.log('❌ Failed to compact summaries:', error);
      return null;
    }
  }

  /**
   * Health check for the backend
   * @returns {Promise<boolean>} True if backend is healthy
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      this.log('❌ Backend health check failed:', error);
      return false;
    }
  }
}

export default new BackendAPIService();