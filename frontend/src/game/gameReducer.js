export const initialGameState = {
  history: [],
  inventory: [],
  currentScene: 'dungeon_cell',
  memories: [],
  turnSummaries: [], // Summary of each player/AI exchange
  compactedSummaries: [], // Compacted summaries when turnSummaries reaches 10
  pickedUpItems: {}, // Track which items have been picked up from each scene
  isLoading: false,
  isStreaming: false,
  streamingMessage: '',
  error: null,
  conversationSummary: '',
};

export const gameActions = {
  SEND_MESSAGE: 'SEND_MESSAGE',
  RECEIVE_RESPONSE: 'RECEIVE_RESPONSE',
  UPDATE_SUMMARY: 'UPDATE_SUMMARY',
  ADD_TURN_SUMMARY: 'ADD_TURN_SUMMARY',
  COMPACT_SUMMARIES: 'COMPACT_SUMMARIES',
  SET_ERROR: 'SET_ERROR',
  RESET_ERROR: 'RESET_ERROR',
  START_STREAMING: 'START_STREAMING',
  UPDATE_STREAMING: 'UPDATE_STREAMING',
  END_STREAMING: 'END_STREAMING',
};

export function gameReducer(state, action) {
  switch (action.type) {
    case gameActions.SEND_MESSAGE:
      return {
        ...state,
        history: [...state.history, { author: 'player', text: action.payload, timestamp: Date.now() }],
        isLoading: true,
        error: null,
      };

    case gameActions.RECEIVE_RESPONSE:
      const { narrative, events = [], gameState: remoteState } = action.payload;
      
      let newState = {
        ...state,
        isLoading: false,
      };

      if (remoteState) {
        // OPTIMIZED: Sync directly with Server State
        newState.currentScene = remoteState.currentScene;
        newState.inventory = remoteState.inventory || [];
        newState.pickedUpItems = remoteState.pickedUpItems || {};
        newState.memories = remoteState.memories || [];
        newState.turnSummaries = remoteState.turnSummaries || [];
        newState.compactedSummaries = remoteState.compactedSummaries || [];
        
        // Sync History with robust merging to preserve local-only messages (like "Welcome")
        let remoteHistory = remoteState.history || [];
        
        // Check for the initial Welcome message in local state
        const welcomeMsg = state.history.length > 0 && state.history[0].text.startsWith('Welcome to the Dungeon Escape') 
          ? state.history[0] 
          : null;

        // If remote history doesn't have the welcome message, prepend it
        if (welcomeMsg && !remoteHistory.some(m => m.text === welcomeMsg.text)) {
          remoteHistory = [welcomeMsg, ...remoteHistory];
        }

        // Map history to preserve timestamps
        newState.history = remoteHistory.map((msg) => {
          // Find matching message in local state to preserve timestamp
          // We match by text and author to be safe
          const localMatch = state.history.find(m => m.text === msg.text && m.author === msg.author);
          return {
            ...msg,
            timestamp: localMatch ? localMatch.timestamp : Date.now()
          };
        });

      } else {
        // FALLBACK: Legacy client-side processing (if backend doesn't send state)
        newState.history = [...state.history, { author: 'game', text: narrative, timestamp: Date.now() }];

        // Process events locally
        events.forEach(event => {
          switch (event.type) {
            case 'ADD_INVENTORY':
              if (event.item && !newState.inventory.includes(event.item)) {
                newState.inventory = [...newState.inventory, event.item];
                if (!newState.pickedUpItems[newState.currentScene]) {
                  newState.pickedUpItems[newState.currentScene] = [];
                }
                newState.pickedUpItems[newState.currentScene] = [
                  ...newState.pickedUpItems[newState.currentScene],
                  event.item
                ];
              }
              break;
            case 'REMOVE_INVENTORY':
              newState.inventory = newState.inventory.filter(item => item !== event.item);
              break;
            case 'CHANGE_SCENE':
              if (event.scene_id) {
                newState.currentScene = event.scene_id;
              }
              break;
            case 'LOG_MEMORY':
              if (event.memory) {
                newState.memories = [...newState.memories, {
                  text: event.memory,
                  timestamp: Date.now()
                }];
              }
              break;
          }
        });
      }

      return newState;

    case gameActions.UPDATE_SUMMARY:
      return {
        ...state,
        conversationSummary: action.payload,
      };

    case gameActions.ADD_TURN_SUMMARY:
      return {
        ...state,
        turnSummaries: [...state.turnSummaries, {
          summary: action.payload,
          timestamp: Date.now()
        }],
      };

    case gameActions.COMPACT_SUMMARIES:
      return {
        ...state,
        compactedSummaries: [...state.compactedSummaries, {
          summary: action.payload,
          timestamp: Date.now(),
          turnCount: state.turnSummaries.length
        }],
        turnSummaries: [], // Clear turn summaries after compacting
      };

    case gameActions.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case gameActions.RESET_ERROR:
      return {
        ...state,
        error: null,
      };

    case gameActions.START_STREAMING:
      return {
        ...state,
        isStreaming: true,
        streamingMessage: '',
        isLoading: true,
      };

    case gameActions.UPDATE_STREAMING:
      return {
        ...state,
        streamingMessage: state.streamingMessage + action.payload,
      };

    case gameActions.END_STREAMING:
      return {
        ...state,
        isStreaming: false,
        streamingMessage: '',
        isLoading: false,
      };

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}