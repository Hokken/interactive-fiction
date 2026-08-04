import { useEffect, useRef, useState } from 'react';
import styles from './SceneAudio.module.scss';

export default function SceneAudio({ audioSrc, volume = 1.0 }) {
  const audioContextRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const fadeTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioSrc, setCurrentAudioSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Web Audio API
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = volume;
    }
    
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      }
    };
  }, []);

  // Update current audio source when prop changes
  useEffect(() => {
    setCurrentAudioSrc(audioSrc);
  }, [audioSrc]);

  // Load audio buffer from URL
  const loadAudioBuffer = async (url) => {
    if (!audioContextRef.current) return null;
    
    try {
      setIsLoading(true);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.log('Failed to load audio buffer:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Create seamless looping audio source
  const createLoopingSource = (buffer) => {
    if (!audioContextRef.current || !gainNodeRef.current) return null;
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    source.connect(gainNodeRef.current);
    
    return source;
  };

  // Handle audio play/pause
  const toggleAudio = async () => {
    if (!audioContextRef.current || !currentAudioSrc) {
      return;
    }

    try {
      if (isPlaying) {
        // Stop current audio
        if (sourceNodeRef.current) {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
          sourceNodeRef.current = null;
        }
        setIsPlaying(false);
      } else {
        // Resume audio context if suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        // Load buffer if not already loaded or if source changed
        if (!audioBufferRef.current || audioBufferRef.current.url !== currentAudioSrc) {
          audioBufferRef.current = await loadAudioBuffer(currentAudioSrc);
          if (audioBufferRef.current) {
            audioBufferRef.current.url = currentAudioSrc;
          }
        }
        
        if (audioBufferRef.current) {
          sourceNodeRef.current = createLoopingSource(audioBufferRef.current);
          if (sourceNodeRef.current) {
            sourceNodeRef.current.start();
            setIsPlaying(true);
          }
        }
      }
    } catch (error) {
      console.log('Audio toggle failed:', error.message);
    }
  };

  // Handle scene changes - fade out current, prepare new
  useEffect(() => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    const handleSceneChange = async () => {
      if (isPlaying && currentAudioSrc) {
        // Fade out current audio
        const fadeOutDuration = 1000; // 1 second fade
        const fadeOutSteps = 50;
        const fadeOutInterval = fadeOutDuration / fadeOutSteps;
        const volumeStep = gainNodeRef.current.gain.value / fadeOutSteps;
        
        let currentStep = 0;
        const fadeOutTimer = setInterval(() => {
          currentStep++;
          const newVolume = Math.max(gainNodeRef.current.gain.value - volumeStep, 0);
          gainNodeRef.current.gain.value = newVolume;
          
          if (currentStep >= fadeOutSteps || newVolume <= 0) {
            clearInterval(fadeOutTimer);
            
            // Stop current source
            if (sourceNodeRef.current) {
              sourceNodeRef.current.stop();
              sourceNodeRef.current.disconnect();
              sourceNodeRef.current = null;
            }
            
            // Load and start new audio
            setTimeout(async () => {
              try {
                if (audioContextRef.current.state === 'suspended') {
                  await audioContextRef.current.resume();
                }
                
                // Load new audio buffer
                audioBufferRef.current = await loadAudioBuffer(currentAudioSrc);
                if (audioBufferRef.current) {
                  audioBufferRef.current.url = currentAudioSrc;
                  
                  // Create new source and start with fade in
                  sourceNodeRef.current = createLoopingSource(audioBufferRef.current);
                  if (sourceNodeRef.current) {
                    gainNodeRef.current.gain.value = 0;
                    sourceNodeRef.current.start();
                    
                    // Fade in new audio
                    const fadeInSteps = 50;
                    const fadeInInterval = fadeOutDuration / fadeInSteps;
                    const fadeInVolumeStep = volume / fadeInSteps;
                    
                    let fadeInStep = 0;
                    const fadeInTimer = setInterval(() => {
                      fadeInStep++;
                      const newVolume = Math.min(gainNodeRef.current.gain.value + fadeInVolumeStep, volume);
                      gainNodeRef.current.gain.value = newVolume;
                      
                      if (fadeInStep >= fadeInSteps || newVolume >= volume) {
                        clearInterval(fadeInTimer);
                        gainNodeRef.current.gain.value = volume;
                      }
                    }, fadeInInterval);
                  }
                }
              } catch (error) {
                console.log('Scene change audio failed:', error.message);
              }
            }, 100);
          }
        }, fadeOutInterval);
      }
    };
    
    handleSceneChange();
  }, [currentAudioSrc, volume]);

  // Update volume when prop changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  return (
    <div className={styles.audioContainer}>
      <button 
        className={styles.audioToggle}
        onClick={toggleAudio}
        disabled={isLoading}
        aria-label={isPlaying ? 'Mute audio' : 'Play audio'}
      >
        {isLoading ? (
          <div className={styles.audioLoading}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#ff8533" strokeWidth="2" strokeLinecap="round" strokeDasharray="15 5" strokeDashoffset="0">
                <animateTransform attributeName="transform" type="rotate" dur="1s" repeatCount="indefinite" values="0 12 12;360 12 12"/>
              </circle>
            </svg>
          </div>
        ) : isPlaying ? (
          <div className={styles.audioIndicator}>
            <div className={styles.equalizer}>
              <div className={styles.bar}></div>
              <div className={styles.bar}></div>
              <div className={styles.bar}></div>
              <div className={styles.bar}></div>
            </div>
          </div>
        ) : (
          <div className={styles.audioOff}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="#ff8533" strokeWidth="2" fill="#ff8533"/>
              <line x1="23" y1="9" x2="17" y2="15" stroke="#ff8533" strokeWidth="2"/>
              <line x1="17" y1="9" x2="23" y2="15" stroke="#ff8533" strokeWidth="2"/>
            </svg>
          </div>
        )}
      </button>
    </div>
  );
}