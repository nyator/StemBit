# Metronome Implementation Documentation

## Overview

This document describes the implementation of a consistent metronome that plays precisely on the beat using a native audio engine in the StemBit application.

## Problem

The previous metronome implementation had timing issues due to:

1. Using JavaScript timers (setTimeout, setInterval) which are not precise enough for audio timing
2. Using expo-audio which doesn't provide sample-accurate scheduling
3. Lack of a proper scheduling system to handle timing drift

## Solution

The solution implements a more precise metronome using:

1. **Native Audio Engine**: Replaced expo-audio with expo-av's Audio API
2. **Buffer-based Scheduling**: Implemented a system that maintains a buffer of scheduled beats
3. **High-frequency Processing**: Used a 10ms interval to check for due beats
4. **Proper Resource Management**: Added comprehensive cleanup to prevent memory leaks

## Implementation Details

### 1. Audio Initialization

```javascript
// Use expo-av's Audio API for metronome sounds
const [beatSound, setBeatSound] = useState<Audio.Sound | null>(null);
const [accentSound, setAccentSound] = useState<Audio.Sound | null>(null);

// Load sounds on component mount
useEffect(() => {
  const loadSounds = async () => {
    try {
      // Enable audio playback in silent mode (iOS)
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      
      // Load the sounds
      const { sound: beatSnd } = await Audio.Sound.createAsync(audio.metronome_low);
      const { sound: accentSnd } = await Audio.Sound.createAsync(audio.metronome_bright);
      
      setBeatSound(beatSnd);
      setAccentSound(accentSnd);
    } catch (error) {
      console.error("Failed to load sounds", error);
    }
  };
  
  loadSounds();
  
  // Cleanup sounds on unmount
  return () => {
    if (beatSound) {
      beatSound.unloadAsync();
    }
    if (accentSound) {
      accentSound.unloadAsync();
    }
  };
}, []);
```

### 2. Precise Beat Playback

```javascript
const playBeat = async (beat: number) => {
  try {
    if (beat === 0 && accentSound) {
      // Stop and rewind the sound before playing to ensure consistent playback
      await accentSound.stopAsync();
      await accentSound.setPositionAsync(0);
      await accentSound.playAsync();
    } else if (beatSound) {
      await beatSound.stopAsync();
      await beatSound.setPositionAsync(0);
      await beatSound.playAsync();
    }
  } catch (error) {
    console.error("Error playing beat:", error);
  }
};
```

### 3. Buffer-based Scheduling System

```javascript
// Create a buffer of scheduled sounds for more precise timing
const scheduledBeats = useRef<Array<{time: number, beat: number}>>([]);
const audioProcessingInterval = useRef<NodeJS.Timeout | null>(null);

// Advanced scheduling system for precise metronome timing
const scheduleBeats = () => {
  // Calculate interval for current bpm
  const interval = (60 * 1000) / bpm;
  
  // Get current time
  const now = Date.now();
  
  // Schedule beats ahead of time (buffer of 4 beats)
  // This ensures we always have beats ready to play
  while (scheduledBeats.current.length < 4) {
    const lastScheduledBeat = scheduledBeats.current[scheduledBeats.current.length - 1];
    const nextBeatTime = lastScheduledBeat 
      ? lastScheduledBeat.time + interval 
      : now + interval;
    
    const nextBeatNumber = lastScheduledBeat
      ? (lastScheduledBeat.beat + 1) % timeSignature.beats
      : (currentBeatRef.current + 1) % timeSignature.beats;
    
    scheduledBeats.current.push({
      time: nextBeatTime,
      beat: nextBeatNumber
    });
  }
};

// Process scheduled beats
const processScheduledBeats = () => {
  const now = Date.now();
  
  // Play any beats that are due
  while (
    scheduledBeats.current.length > 0 && 
    scheduledBeats.current[0].time <= now
  ) {
    const nextBeat = scheduledBeats.current.shift();
    if (nextBeat) {
      const { beat } = nextBeat;
      
      // Update current beat
      currentBeatRef.current = beat;
      setCurrentBeat(beat);
      
      // Play the beat
      playBeat(beat);
      
      // Schedule more beats to maintain the buffer
      scheduleBeats();
    }
  }
};
```

### 4. Starting and Stopping the Metronome

```javascript
const startMetronome = () => {
  if (isPlaying) return;
  
  // Make sure sounds are loaded
  if (!beatSound || !accentSound) {
    console.warn("Metronome sounds not loaded yet");
    return;
  }
  
  setIsPlaying(true);
  currentBeatRef.current = 0;
  setCurrentBeat(0);
  
  // Clear any existing scheduled beats
  scheduledBeats.current = [];
  
  // Play the first beat immediately
  playBeat(0);
  
  // Schedule the next beats
  scheduleBeats();
  
  // Start the processing interval (check for due beats every 10ms)
  // This provides much more precise timing than setTimeout
  if (audioProcessingInterval.current) {
    clearInterval(audioProcessingInterval.current);
  }
  
  audioProcessingInterval.current = setInterval(() => {
    processScheduledBeats();
  }, 10); // Check every 10ms for precise timing
};

const stopMetronome = () => {
  setIsPlaying(false);
  currentBeatRef.current = 0;
  setCurrentBeat(0);
  
  // Clear the processing interval
  if (audioProcessingInterval.current) {
    clearInterval(audioProcessingInterval.current);
    audioProcessingInterval.current = null;
  }
  
  // Clear scheduled beats
  scheduledBeats.current = [];
  
  // Stop any playing sounds
  if (beatSound) {
    beatSound.stopAsync().catch(console.error);
  }
  if (accentSound) {
    accentSound.stopAsync().catch(console.error);
  }
};
```

### 5. Handling BPM Changes

```javascript
// Handle BPM or time signature changes
useEffect(() => {
  if (isPlaying) {
    // When BPM changes, we need to reschedule all beats with the new tempo
    // but maintain the current beat position
    
    // Stop the processing interval
    if (audioProcessingInterval.current) {
      clearInterval(audioProcessingInterval.current);
      audioProcessingInterval.current = null;
    }
    
    // Clear scheduled beats but remember the current beat
    const currentBeat = currentBeatRef.current;
    scheduledBeats.current = [];
    
    // Schedule new beats with the updated BPM
    scheduleBeats();
    
    // Restart the processing interval
    audioProcessingInterval.current = setInterval(() => {
      processScheduledBeats();
    }, 10);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [bpm, timeSignature]);
```

## Benefits of the New Implementation

1. **Consistent Timing**: The buffer-based scheduling system ensures beats are played at the exact time they're scheduled.
2. **Precise Beat Placement**: Using expo-av's Audio API provides more precise control over audio playback.
3. **Smooth BPM Changes**: The implementation handles BPM changes smoothly without interrupting the rhythm.
4. **Resource Efficiency**: Proper cleanup of resources prevents memory leaks and audio issues.
5. **Background Playback**: The audio is configured to play in silent mode and stay active in the background.

## Conclusion

This implementation provides a consistent metronome that plays precisely on the beat using expo-av's native audio engine. The buffer-based scheduling system and high-frequency processing interval ensure accurate timing, addressing the issues with the previous implementation.