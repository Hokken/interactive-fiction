import fs from 'fs';
import path from 'path';

class LoggerService {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'game-interactions.log');
    this.ensureLogDirectory();
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  writeLog(entry) {
    const logEntry = `${this.getTimestamp()} ${entry}\n`;
    this.logStream.write(logEntry);
    // Mirror to console for immediate visibility
    console.log(entry);
  }

  logSeparator(title) {
    const separator = '='.repeat(80);
    this.writeLog(`\n${separator}`);
    this.writeLog(`${title.toUpperCase()}`);
    this.writeLog(`${separator}`);
  }

  logRequestStart(requestId, endpoint, playerAction) {
    this.logSeparator(`REQUEST START - ${requestId}`);
    this.writeLog(`[REQUEST] Endpoint: ${endpoint}`);
    this.writeLog(`[REQUEST] Player Action: "${playerAction}"`);
  }

  logSessionLoaded(requestId, sessionId, isNew) {
    this.writeLog(`[SESSION] Request ID: ${requestId}`);
    this.writeLog(`[SESSION] Session ID: ${sessionId}`);
    this.writeLog(`[SESSION] Status: ${isNew ? 'CREATED NEW' : 'LOADED EXISTING'}`);
  }

  logFrontendData(requestId, gameState) {
    this.writeLog(`[FRONTEND_DATA] Request ID: ${requestId}`);
    this.writeLog(`[FRONTEND_DATA] Current Scene: ${gameState.currentScene?.id || 'unknown'}`);
    this.writeLog(`[FRONTEND_DATA] Inventory: ${JSON.stringify(gameState.inventory || [])}`);
    this.writeLog(`[FRONTEND_DATA] Full Game State:`);
    this.writeLog(JSON.stringify(gameState, null, 2));
  }

  logHaikuValidationPrompt(requestId, prompt, userMessage, sceneContext) {
    this.writeLog(`[HAIKU_PROMPT] Request ID: ${requestId}`);
    this.writeLog(`[HAIKU_PROMPT] User Message: "${userMessage}"`);
    this.writeLog(`[HAIKU_PROMPT] Scene Context: ${JSON.stringify(sceneContext)}`);
    this.writeLog(`[HAIKU_PROMPT] Full Prompt Sent to Haiku:`);
    this.writeLog(`---PROMPT START---`);
    this.writeLog(prompt);
    this.writeLog(`---PROMPT END---`);
  }

  logHaikuResponse(requestId, rawResponse, parsedResult) {
    this.writeLog(`[HAIKU_RESPONSE] Request ID: ${requestId}`);
    this.writeLog(`[HAIKU_RESPONSE] Raw Response from Haiku:`);
    this.writeLog(`---RESPONSE START---`);
    this.writeLog(rawResponse);
    this.writeLog(`---RESPONSE END---`);
    this.writeLog(`[HAIKU_DECISION] Parsed Result: ${JSON.stringify(parsedResult)}`);
  }

  logValidationDecision(requestId, isValid, reason, action) {
    this.writeLog(`[VALIDATION_DECISION] Request ID: ${requestId}`);
    this.writeLog(`[VALIDATION_DECISION] Is Valid: ${isValid}`);
    this.writeLog(`[VALIDATION_DECISION] Reason: ${reason}`);
    this.writeLog(`[VALIDATION_DECISION] Action: ${action}`); // "REJECT_TO_USER" or "PROCEED_TO_OPENAI"
  }

  logVectorSearch(requestId, query) {
    this.writeLog(`[VECTOR_SEARCH] Request ID: ${requestId}`);
    this.writeLog(`[VECTOR_SEARCH] Query: "${query}"`);
  }

  logVectorSearchResult(requestId, results) {
    this.writeLog(`[VECTOR_SEARCH] Request ID: ${requestId}`);
    this.writeLog(`[VECTOR_SEARCH] Found ${results.length} relevant memories/context:`);
    results.forEach((res, idx) => {
      this.writeLog(`  ${idx + 1}. "${res}"`);
    });
  }

  logMemoryAddition(requestId, memoryText, metadata) {
    this.writeLog(`[MEMORY_ADD] Request ID: ${requestId}`);
    this.writeLog(`[MEMORY_ADD] Text: "${memoryText}"`);
    this.writeLog(`[MEMORY_ADD] Metadata: ${JSON.stringify(metadata)}`);
  }

  logMemoryAdded(requestId, memoryText, metadata) {
    this.writeLog(`[MEMORY_ADDED] Request ID: ${requestId}`);
    this.writeLog(`[MEMORY_ADDED] Successfully added memory. Text: "${memoryText}"`);
    this.writeLog(`[MEMORY_ADDED] Metadata: ${JSON.stringify(metadata)}`);
  }

  logDebug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog(`[DEBUG] ${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`);
    }
  }

  logRejectionResponse(requestId, rejectionResponse) {
    this.writeLog(`[REJECTION_RESPONSE] Request ID: ${requestId}`);
    this.writeLog(`[REJECTION_RESPONSE] Response Sent to Frontend:`);
    this.writeLog(JSON.stringify(rejectionResponse, null, 2));
  }

  logOpenAIPrompt(requestId, systemPrompt, gameContext) {
    this.writeLog(`[OPENAI_PROMPT] Request ID: ${requestId}`);
    this.writeLog(`[OPENAI_PROMPT] System Prompt:`);
    this.writeLog(`---SYSTEM PROMPT START---`);
    this.writeLog(systemPrompt);
    this.writeLog(`---SYSTEM PROMPT END---`);
    this.writeLog(`[OPENAI_PROMPT] Game Context:`);
    this.writeLog(`---GAME CONTEXT START---`);
    this.writeLog(gameContext);
    this.writeLog(`---GAME CONTEXT END---`);
  }

  logOpenAIResponse(requestId, rawResponse) {
    this.writeLog(`[OPENAI_RESPONSE] Request ID: ${requestId}`);
    this.writeLog(`[OPENAI_RESPONSE] Raw Response from OpenAI:`);
    this.writeLog(`---OPENAI RESPONSE START---`);
    this.writeLog(rawResponse);
    this.writeLog(`---OPENAI RESPONSE END---`);
  }

  logJSONProcessing(requestId, operation, inputData, outputData, error = null) {
    this.writeLog(`[JSON_PROCESSING] Request ID: ${requestId}`);
    this.writeLog(`[JSON_PROCESSING] Operation: ${operation}`); // "PARSE", "EXTRACT", "VALIDATE", "FIX"
    if (error) {
      this.writeLog(`[JSON_PROCESSING] Error: ${error}`);
    }
    this.writeLog(`[JSON_PROCESSING] Input Data:`);
    this.writeLog(`---INPUT START---`);
    this.writeLog(typeof inputData === 'string' ? inputData : JSON.stringify(inputData, null, 2));
    this.writeLog(`---INPUT END---`);
    this.writeLog(`[JSON_PROCESSING] Output Data:`);
    this.writeLog(`---OUTPUT START---`);
    this.writeLog(typeof outputData === 'string' ? outputData : JSON.stringify(outputData, null, 2));
    this.writeLog(`---OUTPUT END---`);
  }

  logStateUpdate(requestId, oldState, newState, appliedEvents) {
    this.writeLog(`[STATE_UPDATE] Request ID: ${requestId}`);
    this.writeLog(`[STATE_UPDATE] Applied Events: ${JSON.stringify(appliedEvents)}`);
    
    // Log diffs
    if (oldState.currentScene !== newState.currentScene) {
      this.writeLog(`[STATE_UPDATE] Scene Change: ${oldState.currentScene} -> ${newState.currentScene}`);
    }
    const addedItems = newState.inventory.filter(i => !oldState.inventory.includes(i));
    const removedItems = oldState.inventory.filter(i => !newState.inventory.includes(i));
    if (addedItems.length) this.writeLog(`[STATE_UPDATE] Items Added: ${addedItems.join(', ')}`);
    if (removedItems.length) this.writeLog(`[STATE_UPDATE] Items Removed: ${removedItems.join(', ')}`);
    
    this.writeLog(`[STATE_UPDATE] New History Length: ${newState.history.length}`);
  }

  logFinalResponse(requestId, finalResponse) {
    this.writeLog(`[FINAL_RESPONSE] Request ID: ${requestId}`);
    this.writeLog(`[FINAL_RESPONSE] Response Sent to Frontend:`);
    this.writeLog(JSON.stringify(finalResponse, null, 2));
  }

  logError(requestId, error, context = '') {
    this.writeLog(`[ERROR] Request ID: ${requestId}`);
    this.writeLog(`[ERROR] Context: ${context}`);
    this.writeLog(`[ERROR] Error Message: ${error.message}`);
    this.writeLog(`[ERROR] Stack Trace:`);
    this.writeLog(error.stack);
  }

  logRequestEnd(requestId, duration, success) {
    this.writeLog(`[REQUEST_END] Request ID: ${requestId}`);
    this.writeLog(`[REQUEST_END] Duration: ${duration}ms`);
    this.writeLog(`[REQUEST_END] Success: ${success}`);
    this.logSeparator(`REQUEST END - ${requestId}`);
    this.writeLog(''); // Empty line for separation
  }

  logStreamingStart(requestId) {
    this.writeLog(`[STREAMING] Request ID: ${requestId} - Starting streaming response`);
  }

  logStreamingChunk(requestId, chunkContent) {
    // Only write to file, do not clutter console
    const entry = `[STREAMING_CHUNK] Request ID: ${requestId} Content: "${chunkContent}"`;
    const logEntry = `${this.getTimestamp()} ${entry}\n`;
    this.logStream.write(logEntry);
  }

  logStreamingEnd(requestId) {
    this.writeLog(`[STREAMING] Request ID: ${requestId} - Streaming completed`);
  }

  // Additional logging for summary and compact operations
  logSummaryRequest(requestId, playerMessage, aiResponse) {
    this.logSeparator(`SUMMARY REQUEST - ${requestId}`);
    this.writeLog(`[SUMMARY_REQUEST] Player Message: "${playerMessage}"`);
    this.writeLog(`[SUMMARY_REQUEST] AI Response: "${aiResponse}"`);
  }

  logSummaryResponse(requestId, summary) {
    this.writeLog(`[SUMMARY_RESPONSE] Request ID: ${requestId}`);
    this.writeLog(`[SUMMARY_RESPONSE] Generated Summary: "${summary}"`);
  }

  logCompactRequest(requestId, summaries) {
    this.logSeparator(`COMPACT REQUEST - ${requestId}`);
    this.writeLog(`[COMPACT_REQUEST] Number of summaries: ${summaries.length}`);
    this.writeLog(`[COMPACT_REQUEST] Summaries to compact:`);
    summaries.forEach((summary, index) => {
      this.writeLog(`  ${index + 1}. "${summary}"`);
    });
  }

  logCompactResponse(requestId, compactedSummary) {
    this.writeLog(`[COMPACT_RESPONSE] Request ID: ${requestId}`);
    this.writeLog(`[COMPACT_RESPONSE] Compacted Summary: "${compactedSummary}"`);
  }

  // Utility method to generate unique request IDs
  generateRequestId() {
    return `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Method to log system startup
  logSystemStart() {
    this.logSeparator('SYSTEM STARTUP');
    this.writeLog(`[SYSTEM] Backend server starting up`);
    this.writeLog(`[SYSTEM] Log file: ${this.logFile}`);
    this.writeLog(`[SYSTEM] Node.js version: ${process.version}`);
    this.writeLog(`[SYSTEM] Environment: ${process.env.NODE_ENV}`);
    this.logSeparator('SYSTEM READY');
    this.writeLog('');
  }
}

export default new LoggerService();