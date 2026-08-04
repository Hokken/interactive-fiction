import { useState, useEffect } from 'react';
import { scenes } from '../game/scenes';
import GameChat from './GameChat';
import styles from './SceneInfo.module.scss';

export default function SceneInfo({ currentScene, messages, isLoading, onSendMessage, pickedUpItems, streamingMessage }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayScene, setDisplayScene] = useState(currentScene);
  const scene = scenes[displayScene];
  
  // Handle scene transitions with fade effect
  useEffect(() => {
    if (currentScene !== displayScene) {
      setIsTransitioning(true);
      
      // Start fade out
      const fadeOutTimer = setTimeout(() => {
        setDisplayScene(currentScene);
        
        // Start fade in after scene content changes
        const fadeInTimer = setTimeout(() => {
          setIsTransitioning(false);
        }, 50); // Small delay to ensure content has updated
        
        return () => clearTimeout(fadeInTimer);
      }, 300); // Fade out duration
      
      return () => clearTimeout(fadeOutTimer);
    }
  }, [currentScene, displayScene]);
  
  if (!scene) {
    return <div className={styles.sceneInfo}>Unknown location</div>;
  }

  return (
    <div className={styles.sceneInfo}>
      <div className={`${styles.sceneContent} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>
        <div className={styles.imageContainer}>
          <img 
            src={scene.image} 
            alt={scene.name}
            className={styles.sceneImage}
          />
        </div>
        
        <div className={styles.textContent}>
          <h3 className={styles.title}>{scene.name}</h3>
          <p className={styles.description}>{scene.description}</p>
          
          <div className={styles.details}>
            <div className={styles.section}>
              <h4>Exits:</h4>
              <ul>
                {Object.entries(scene.exits).map(([direction, exitData]) => {
                  let destination, blocked, blockedReason;
                  
                  if (typeof exitData === 'string') {
                    // Old format
                    destination = exitData;
                    blocked = false;
                  } else {
                    // New format
                    destination = exitData.id;
                    blocked = exitData.blocked;
                    blockedReason = exitData.blocked_reason;
                  }
                  
                  return (
                    <li key={direction} className={blocked ? styles.blockedExit : ''}>
                      <span className={styles.direction}>{direction}</span>
                      <span className={styles.arrow}>→</span>
                      <span className={styles.destination}>
                        {scenes[destination]?.name || destination}
                        {blocked && <span className={styles.blocked}> (blocked: {blockedReason})</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            {(() => {
              const availableItems = scene.items.filter(item => !pickedUpItems.includes(item));
              return (
                <div className={styles.section}>
                  <h4>Items you can see:</h4>
                  {availableItems.length > 0 ? (
                    <ul>
                      {availableItems.map((item, index) => (
                        <li key={index} className={styles.item}>
                          <img 
                            src={`/src/assets/items/${item.replace('_', '-')}.png`} 
                            alt={item}
                            className={styles.itemIcon}
                            title={item.replace('_', ' ')}
                          />
                          <span className={styles.itemTooltip}>{item.replace('_', ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={styles.noItems}>No items can be seen</div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      
      <div className={styles.chatSection}>
        <GameChat 
          messages={messages}
          isLoading={isLoading}
          onSendMessage={onSendMessage}
          streamingMessage={streamingMessage}
        />
      </div>
    </div>
  );
}