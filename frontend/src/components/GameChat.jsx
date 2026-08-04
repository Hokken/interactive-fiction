import { useState, useRef, useEffect } from 'react';
import styles from './GameChat.module.scss';

export default function GameChat({ onSendMessage, messages, isLoading, streamingMessage }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={styles.gameChat}>
      <div className={styles.messagesContainer}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`${styles.message} ${
              message.author === 'player' ? styles.playerMessage : styles.gameMessage
            }`}
          >
            <div className={styles.author}>
              {message.author === 'player' ? 'You' : 'Game Master'}
            </div>
            <div className={styles.text}>{message.text}</div>
          </div>
        ))}
        {streamingMessage && (
          <div className={styles.message + ' ' + styles.gameMessage}>
            <div className={styles.author}>Game Master</div>
            <div className={styles.text}>
              {streamingMessage}
              <span className={styles.streamingCursor}>|</span>
            </div>
          </div>
        )}
        {isLoading && !streamingMessage && (
          <div className={styles.loadingMessage}>
            <div className={styles.author}>Game Master</div>
            <div className={styles.loadingDots}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you do?"
          disabled={isLoading}
          className={styles.input}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className={styles.sendButton}
        >
          {isLoading ? 'Thinking...' : 'Send'}
        </button>
      </form>
    </div>
  );
}