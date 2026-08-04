import { useReducer, useCallback, useEffect, useRef } from 'react';
import { gameReducer, initialGameState, gameActions } from '../game/gameReducer';
import { scenes } from '../game/scenes';
import gameAI from '../services/gameAI';
import GameChat from './GameChat';
import GameInventory from './GameInventory';
import SceneInfo from './SceneInfo';
import SceneAudio from './SceneAudio';
import styles from './TextAdventureGame.module.scss';

export default function TextAdventureGame() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const initializedRef = useRef(false);

  // Initial game message
  useEffect(() => {
    if (!initializedRef.current && state.history.length === 0) {
      initializedRef.current = true;
      dispatch({ 
        type: gameActions.RECEIVE_RESPONSE, 
        payload: { 
          narrative: 'Welcome to the Dungeon Escape! You wake up in a damp, cold dungeon cell. Your memory is foggy, but one thing is clear - you need to escape. Type "look" to examine your surroundings, or try other actions like "take", "use", or "go".', 
          events: [] 
        } 
      });
    }
  }, [state.history.length]);

  // Check if we need to summarize history
  useEffect(() => {
    const checkAndSummarize = async () => {
      if (state.history.length > 20 && state.history.length % 10 === 0) {
        const summary = await gameAI.summarizeHistory(state.history.slice(0, -10));
        if (summary) {
          dispatch({ type: gameActions.UPDATE_SUMMARY, payload: summary });
        }
      }
    };
    
    checkAndSummarize();
  }, [state.history.length]);

  // Check if we need to compact summaries
  useEffect(() => {
    const compact = async () => {
      if (state.turnSummaries.length >= 10) {
        const summariesToCompact = state.turnSummaries.map(s => s.summary);
        const compactedSummary = await gameAI.compactSummaries(summariesToCompact);
        if (compactedSummary) {
          dispatch({ type: gameActions.COMPACT_SUMMARIES, payload: compactedSummary });
        }
      }
    };
    compact();
  }, [state.turnSummaries]);

  const handleError = (error) => {
    console.error('Game AI error:', error);
    dispatch({ type: gameActions.END_STREAMING });
    dispatch({ 
      type: gameActions.SET_ERROR, 
      payload: 'Failed to process action. Make sure the backend server is running.' 
    });
    
    // Add error message to chat
    dispatch({
      type: gameActions.RECEIVE_RESPONSE,
      payload: {
        narrative: "I'm having trouble understanding that. Please make sure the backend server is running and try again.",
        events: []
      }
    });
  };

  const handleSendMessage = useCallback(async (message) => {
    dispatch({ type: gameActions.SEND_MESSAGE, payload: message });
    dispatch({ type: gameActions.START_STREAMING });

    try {
      await gameAI.processPlayerActionStream(
        state,
        message,
        // onChunk - append each streaming chunk
        (chunk) => {
          dispatch({ type: gameActions.UPDATE_STREAMING, payload: chunk });
        },
        // onComplete - handle final response
        (response) => {
          dispatch({ type: gameActions.END_STREAMING });
          dispatch({ type: gameActions.RECEIVE_RESPONSE, payload: response });

          // Generate turn summary after successful AI response
          gameAI.generateTurnSummary(message, response.narrative).then(turnSummary => {
            if (turnSummary) {
              dispatch({ type: gameActions.ADD_TURN_SUMMARY, payload: turnSummary });
            }
          });
        },
        // onError - handle errors
        handleError
      );
    } catch (error) {
      handleError(error);
    }
  }, [state]);

  return (
    <div className={styles.gameContainer}>
      <div className={styles.header}>
        <h1>Dungeon Escape <span className={styles.subtitle}>A Text Adventure Game</span></h1>
      </div>

      <div className={styles.navigation}>
        <GameInventory 
          inventory={state.inventory} 
          onUseItem={handleSendMessage}
        />
        <SceneAudio audioSrc={scenes[state.currentScene]?.audio} />
      </div>

      <div className={styles.gameLayout}>
        <div className={styles.mainContent}>
          <SceneInfo 
            currentScene={state.currentScene}
            messages={state.history}
            isLoading={state.isLoading}
            onSendMessage={handleSendMessage}
            pickedUpItems={state.pickedUpItems[state.currentScene] || []}
            streamingMessage={state.streamingMessage}
          />
          
          {state.memories.length > 0 && (
            <div className={styles.memories}>
              <h3>Important Events</h3>
              <ul>
                {state.memories.slice(-5).map((memory, index) => (
                  <li key={index}>{memory.text}</li>
                ))}
              </ul>
            </div>
          )}
          
          {state.error && (
            <div className={styles.error}>
              <p>{state.error}</p>
              <button onClick={() => dispatch({ type: gameActions.RESET_ERROR })}>
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}