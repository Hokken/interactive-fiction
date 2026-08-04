import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Temporary: In-memory store for disabled persistence
const inMemorySessions = {};

class SessionService {
  constructor() {
    // Original path for context, but not used in this temporary stateless mode
    this.sessionsDir = path.join(process.cwd(), 'data', 'sessions');
  }

  // Method now a no-op in stateless mode
  async ensureSessionsDir() {
    // No-op
  }

  // Method now a no-op in stateless mode
  getSessionFilePath(sessionId) {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  async createSession(initialState = {}) {
    const sessionId = uuidv4();
    const sessionData = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameState: initialState
    };
    // Store in-memory for the duration of the server process (not persistent)
    inMemorySessions[sessionId] = sessionData;
    console.log(`[SessionService] Created session ${sessionId}. Total sessions: ${Object.keys(inMemorySessions).length}`);
    return sessionData;
  }

  async getSession(sessionId) {
    const session = inMemorySessions[sessionId] || null;
    console.log(`[SessionService] Retrieving session ${sessionId}. Found: ${!!session}`);
    return session;
  }

  async updateSession(sessionId, gameState) {
    console.log(`[SessionService] Updating session ${sessionId}. Exists: ${!!inMemorySessions[sessionId]}`);
    // In stateless mode, this is a no-op for file persistence.
    // We update the in-memory session for current request scope.
    if (inMemorySessions[sessionId]) {
      inMemorySessions[sessionId].gameState = gameState;
      inMemorySessions[sessionId].updatedAt = new Date().toISOString();
    }
    return inMemorySessions[sessionId] || null;
  }
}

export default new SessionService();
