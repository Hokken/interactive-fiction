import express from 'express';
import { z } from 'zod';
import anthropicService from '../services/anthropicService.js';
import openaiService from '../services/openaiService.js';
import logger from '../services/loggerService.js';
import sessionService from '../services/sessionService.js';
import { scenes } from '../data/scenes.js';

const router = express.Router();

// Validation Schemas
const actionSchema = z.object({
  playerAction: z.string().min(1),
  sessionId: z.string().optional().nullable(),
});

const summarySchema = z.object({
  playerMessage: z.string(),
  aiResponse: z.string(),
});

const compactSchema = z.object({
  summaries: z.array(z.string()),
});

// Initial Game State
const INITIAL_GAME_STATE = {
  currentScene: 'dungeon_cell',
  inventory: [],
  history: [],
  memories: [],
  turnSummaries: [],
  compactedSummaries: [],
  generalRules: [],
  pickedUpItems: {}, // Map of sceneId -> [items]
  worldState: {} // Generic dictionary for persistent world flags (e.g., unlocked doors)
};

/**
 * Get a random fantasy-themed rejection message with light humor
 */
function getRandomRejectionMessage() {
  const messages = [
    "I am afraid that this is not possible.",
    "The mystical forces seem to reject this notion.",
    "Alas, such endeavors are beyond thy capabilities.",
    "The ancient laws of this realm forbid such actions.",
    "Mayhap thou shouldst try a different approach, friend."
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Validate a single game event against game rules
 */
function validateEvent(event, currentState) {
  const currentSceneId = currentState.currentScene;
  const currentScene = scenes[currentSceneId];

  if (!currentScene) return false;

  switch (event.type) {
    case 'CHANGE_SCENE': {
      // Rule 1: Target scene must exist
      if (!scenes[event.scene_id]) {
        console.warn(`[Logic] Invalid Scene ID: ${event.scene_id}`);
        return false;
      }
      
      // Rule 2: Must be a valid exit from current scene
      // We need to find the specific exit entry to check if it's blocked
      const exitEntry = Object.entries(currentScene.exits || {}).find(([dir, exit]) => {
        const targetId = (typeof exit === 'object') ? exit.id : exit;
        return targetId === event.scene_id;
      });

      if (!exitEntry) {
        console.warn(`[Logic] Invalid Transition: ${currentSceneId} -> ${event.scene_id}`);
        return false;
      }

      const [direction, exitData] = exitEntry;

      // Rule 3: Check if exit is blocked and not unblocked in worldState
      if (typeof exitData === 'object' && exitData.blocked) {
        const flagKey = `${currentSceneId}_${direction}_unlocked`;
        if (!currentState.worldState?.[flagKey]) {
          console.warn(`[Logic] Attempted to use blocked exit: ${direction}`);
          return false;
        }
      }

      return true;
    }
    case 'UNBLOCK_EXIT': {
      // Rule: Must refer to a valid exit in the current (or specified) scene
      const targetSceneId = event.scene_id || currentSceneId;
      const targetScene = scenes[targetSceneId];
      
      if (!targetScene || !targetScene.exits[event.direction]) {
        console.warn(`[Logic] Invalid unblock target: ${targetSceneId} ${event.direction}`);
        return false;
      }
      return true;
    }
    case 'ADD_INVENTORY': {
      // Rule: Item must be available in the scene
      const sceneItems = currentScene.items || [];
      const pickedUp = currentState.pickedUpItems?.[currentSceneId] || [];
      
      if (!sceneItems.includes(event.item)) {
        console.warn(`[Logic] Item not in scene: ${event.item}`);
        return false;
      }
      if (pickedUp.includes(event.item)) {
        console.warn(`[Logic] Item already picked up: ${event.item}`);
        return false;
      }
      return true;
    }
    case 'REMOVE_INVENTORY':
      return currentState.inventory.includes(event.item);
    default:
      return true;
  }
}

/**
 * Helper to apply events to the game state (Server-Side Reducer)
 */
function applyEventsToState(state, events) {
  if (!events || !Array.isArray(events)) return state;

  const newState = { ...state };
  
  // Ensure arrays and objects exist
  newState.inventory = [...(state.inventory || [])];
  newState.memories = [...(state.memories || [])];
  newState.pickedUpItems = { ...(state.pickedUpItems || {}) };
  newState.worldState = { ...(state.worldState || {}) };

  events.forEach(event => {
    // Validate event before applying
    if (!validateEvent(event, state)) {
      console.log(`⚠️ Event blocked by logic engine: ${event.type} ${JSON.stringify(event)}`);
      return;
    }

    switch (event.type) {
      case 'CHANGE_SCENE':
        newState.currentScene = event.scene_id;
        break;
      case 'UNBLOCK_EXIT':
        // Create a unique key for this exit state: "sceneId_direction_unlocked"
        // event.scene_id might be null if implied current scene, but best to be explicit or fallback
        const targetScene = event.scene_id || newState.currentScene;
        const flagKey = `${targetScene}_${event.direction}_unlocked`;
        newState.worldState[flagKey] = true;
        console.log(`🔓 Unlocked exit: ${flagKey}`);
        break;
      case 'ADD_INVENTORY':
        if (!newState.inventory.includes(event.item)) {
          newState.inventory.push(event.item);
          // Track that item was picked up in this scene
          const sceneId = newState.currentScene;
          if (!newState.pickedUpItems[sceneId]) {
            newState.pickedUpItems[sceneId] = [];
          }
          if (!newState.pickedUpItems[sceneId].includes(event.item)) {
            newState.pickedUpItems[sceneId].push(event.item);
          }
        }
        break;
      case 'REMOVE_INVENTORY':
        newState.inventory = newState.inventory.filter(item => item !== event.item);
        break;
      case 'LOG_MEMORY':
        newState.memories.push({
          text: event.memory,
          turn: newState.history.length
        });
        break;
    }
  });

  return newState;
}

/**
 * POST /api/game/action
 * Process a player action through validation and AI processing
 */
router.post('/action', async (req, res) => {
  const requestId = logger.generateRequestId();
  const startTime = Date.now();
  let success = false;

  try {
    // 1. Validation
    const result = actionSchema.safeParse(req.body);
    if (!result.success) {
      const error = `Validation failed: ${result.error.message}`;
      logger.logError(requestId, new Error(error), 'Request validation');
      return res.status(400).json({ error });
    }

    const { playerAction, sessionId: reqSessionId } = result.data;
    let session;
    let isNewSession = false;

    // 2. Load or Create Session
    if (reqSessionId) {
      session = await sessionService.getSession(reqSessionId);
    }

    if (!session) {
      // Create new session if ID missing or not found
      const newSession = await sessionService.createSession({ ...INITIAL_GAME_STATE });
      session = newSession;
      isNewSession = true;
    }

    const sessionId = session.id;
    logger.logSessionLoaded(requestId, sessionId, isNewSession);

    let gameState = session.gameState;

    // Log request start
    logger.logRequestStart(requestId, '/api/game/action', playerAction);
    logger.logFrontendData(requestId, gameState);

    console.log(`🎮 Processing action: "${playerAction}" in scene: ${gameState.currentScene} (Session: ${sessionId})`);

    // Step 1: Validate the request with Anthropic Haiku (Dynamic Guardrail)
    const validation = await anthropicService.validateUserRequest(playerAction, gameState, requestId);
    
    if (!validation.isValid) {
      console.log(`❌ Request rejected: ${validation.reason} [${validation.rejectionType}]`);
      
      let narrativeMessage = validation.reason;
      
      // Provide generic fallback if the reason is empty
      if (!narrativeMessage) {
        narrativeMessage = getRandomRejectionMessage();
      }

      // UPDATE STATE for rejection (persist history)
      const oldGameState = JSON.parse(JSON.stringify(gameState));
      gameState.history = [...(gameState.history || [])];
      gameState.history.push({ author: 'player', text: playerAction });
      gameState.history.push({ author: 'ai', text: narrativeMessage });
      
      // Save session with rejection history
      await sessionService.updateSession(sessionId, gameState);
      
      const rejectionResponse = {
        narrative: narrativeMessage,
        player_feedback: null,
        events: [],
        validation_failed: true,
        validation_reason: validation.reason,
        sessionId, // Return session ID
        gameState // Return UPDATED state
      };
      
      logger.logRejectionResponse(requestId, rejectionResponse);
      logger.logFinalResponse(requestId, rejectionResponse);
      success = true;
      
      return res.json(rejectionResponse);
    }

    console.log(`✅ Request validated: ${validation.reason}`);
    const interactionType = validation.type || 'action';

    // Step 2: Process with OpenAI if validation passed
    const aiResponse = await openaiService.processPlayerAction(gameState, playerAction, requestId, interactionType);
    
    console.log(`🤖 AI response generated successfully`);

    // Step 3: Update Server-Side State
    const oldGameState = JSON.parse(JSON.stringify(gameState)); // Deep copy for logging

    // Add history
    gameState.history = [...(gameState.history || [])];
    gameState.history.push({ author: 'player', text: playerAction });
    gameState.history.push({ author: 'ai', text: aiResponse.narrative });

    // Apply events (Filtered by Deterministic Logic)
    const newGameState = applyEventsToState(gameState, aiResponse.events);
    
    // Log state update
    logger.logStateUpdate(requestId, oldGameState, newGameState, aiResponse.events);

    // Save session
    await sessionService.updateSession(sessionId, newGameState);

    const finalResponse = {
      ...aiResponse,
      validation_passed: true,
      validation_reason: validation.reason,
      sessionId,
      gameState: newGameState // Send updated state to sync frontend
    };

    logger.logFinalResponse(requestId, finalResponse);
    success = true;

    res.json(finalResponse);

  } catch (error) {
    logger.logError(requestId, error, 'Processing game action');
    console.error('Game action error:', error);
    
    const errorResponse = {
      error: 'Failed to process game action',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
    
    logger.logFinalResponse(requestId, errorResponse);
    res.status(500).json(errorResponse);
  } finally {
    const duration = Date.now() - startTime;
    logger.logRequestEnd(requestId, duration, success);
  }
});

/**
 * POST /api/game/action/stream
 * Process a player action with streaming response
 */
router.post('/action/stream', async (req, res) => {
  const requestId = logger.generateRequestId();
  const startTime = Date.now();
  let success = false;

  try {
    // Validation
    const result = actionSchema.safeParse(req.body);
    if (!result.success) {
      const error = `Validation failed: ${result.error.message}`;
      logger.logError(requestId, new Error(error), 'Streaming request validation');
      return res.status(400).json({ error });
    }

    const { playerAction, sessionId: reqSessionId } = result.data;
    let session;
    let isNewSession = false;

    if (reqSessionId) {
      session = await sessionService.getSession(reqSessionId);
    }

    if (!session) {
       const newSession = await sessionService.createSession({ ...INITIAL_GAME_STATE });
       session = newSession;
       isNewSession = true;
    }

    const sessionId = session.id;
    logger.logSessionLoaded(requestId, sessionId, isNewSession);

    let gameState = session.gameState;

    // Log request start
    logger.logRequestStart(requestId, '/api/game/action/stream', playerAction);
    logger.logStreamingStart(requestId);
    logger.logFrontendData(requestId, gameState);

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}

`);
    };

    console.log(`🎮 Streaming action: "${playerAction}" (Session: ${sessionId})`);

    // Step 1: Validate with Anthropic
    console.log(`⏱️ Start Validation: ${Date.now() - startTime}ms`);
    sendEvent({ type: 'validating', message: 'Validating request...' });
    
    const validation = await anthropicService.validateUserRequest(playerAction, gameState, requestId);
    console.log(`⏱️ End Validation: ${Date.now() - startTime}ms`);
    
    if (!validation.isValid) {
      // ... (existing rejection logic)
    }

    sendEvent({ type: 'validated', message: 'Request validated, processing...' });
    const interactionType = validation.type || 'action';
    console.log(`🔍 Interaction Type: ${interactionType}`);

    // Step 2: Process with OpenAI streaming
    console.log(`⏱️ Start OpenAI Stream: ${Date.now() - startTime}ms`);
    const stream = openaiService.processPlayerActionStream(gameState, playerAction, requestId, interactionType);
    
    let isFirstChunk = true;
    for await (const chunk of stream) {
      if (isFirstChunk) {
        console.log(`⏱️ First Chunk Received: ${Date.now() - startTime}ms`);
        isFirstChunk = false;
      }
      
      if (chunk.type === 'error') {
        logger.logError(requestId, new Error(chunk.error), 'OpenAI streaming error');
        sendEvent({ type: 'error', error: chunk.error });
        break;
      } else if (chunk.type === 'complete') {
        const aiResponse = chunk.data;
        
        // Capture old state
        const oldGameState = JSON.parse(JSON.stringify(gameState));

        // UPDATE STATE
        const newHistory = [...(gameState.history || [])];
        newHistory.push({ author: 'player', text: playerAction });
        newHistory.push({ author: 'ai', text: aiResponse.narrative });
        
        gameState.history = newHistory;
        console.log(`🔍 STATE UPDATE: History length updated to ${gameState.history.length}`);

        const newGameState = applyEventsToState(gameState, aiResponse.events);
        
        // Ensure newGameState carries the history (in case applyEventsToState created a shallow copy without it, though it shouldn't)
        newGameState.history = newHistory;
        
        console.log('🔍 AI Generated Events:', JSON.stringify(aiResponse.events, null, 2));
        
        // Log update
        logger.logStateUpdate(requestId, oldGameState, newGameState, aiResponse.events);

        await sessionService.updateSession(sessionId, newGameState);

        const finalData = {
          ...aiResponse,
          validation_passed: true,
          validation_reason: validation.reason,
          sessionId,
          gameState: newGameState
        };

        console.log(`🚀 SENDING COMPLETE: History length ${finalData.gameState.history.length}`);
        logger.logFinalResponse(requestId, finalData);
        sendEvent({ type: 'complete', data: finalData });
        success = true;
        break;
      } else if (chunk.type === 'chunk') {
        logger.logStreamingChunk(requestId, chunk.content);
        sendEvent({ type: 'chunk', content: chunk.content });
      }
    }

    logger.logStreamingEnd(requestId);
    res.end();

  } catch (error) {
    logger.logError(requestId, error, 'Streaming game action failed');
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  } finally {
    const duration = Date.now() - startTime;
    logger.logRequestEnd(requestId, duration, success);
  }
});

/**
 * POST /api/game/summary
 */
router.post('/summary', async (req, res) => {
  const requestId = logger.generateRequestId();
  try {
    const result = summarySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.message });

    const { playerMessage, aiResponse } = result.data;
    logger.logSummaryRequest(requestId, playerMessage, aiResponse);

    const summary = await openaiService.generateTurnSummary(playerMessage, aiResponse);
    logger.logSummaryResponse(requestId, summary);
    
    res.json({ summary });
  } catch (error) {
    logger.logError(requestId, error, 'Generating summary');
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * POST /api/game/compact
 */
router.post('/compact', async (req, res) => {
  const requestId = logger.generateRequestId();
  try {
    const result = compactSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.message });

    const { summaries } = result.data;
    logger.logCompactRequest(requestId, summaries);

    const compactedSummary = await openaiService.compactSummaries(summaries);
    logger.logCompactResponse(requestId, compactedSummary);
    
    res.json({ compactedSummary });
  } catch (error) {
    logger.logError(requestId, error, 'Compacting summaries');
    res.status(500).json({ error: 'Failed to compact summaries' });
  }
});

export default router;
