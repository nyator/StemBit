# Metronome Gradual Tempo Transition

## Overview
This document describes the changes made to implement gradual tempo transitions in the metronome feature. Previously, when the tempo (BPM) was changed while the metronome was playing, it would abruptly change to the new tempo by stopping and restarting with the new tempo. The new implementation gradually transitions from the current tempo to the target tempo over a short period of time.

## Files Modified
- `/app/(tabs)/metro.tsx`

## Implementation Details

### 1. Added State for Tempo Transition
Added reference variables to track the current tempo, target tempo, and transition state:
```typescript
// For gradual tempo transition
const currentTempoRef = useRef(120); // Actual current tempo that may be transitioning
const targetTempoRef = useRef(120); // Target tempo to transition to
const tempoTransitionStartTimeRef = useRef<number | null>(null); // When the transition started
const tempoTransitionDurationRef = useRef(1000); // Duration of transition in ms (default 1 second)
```

### 2. Added Function to Calculate Current Tempo During Transition
Implemented a function that calculates the current tempo based on the transition state using linear interpolation:
```typescript
// Calculate the current tempo based on transition state
const getCurrentTempo = () => {
  // If no transition is in progress, return the target tempo
  if (tempoTransitionStartTimeRef.current === null) {
    return targetTempoRef.current;
  }
  
  const now = Date.now();
  const elapsedTime = now - tempoTransitionStartTimeRef.current;
  const duration = tempoTransitionDurationRef.current;
  
  // If transition is complete, return target tempo
  if (elapsedTime >= duration) {
    tempoTransitionStartTimeRef.current = null;
    currentTempoRef.current = targetTempoRef.current;
    return targetTempoRef.current;
  }
  
  // Calculate the current tempo using linear interpolation
  const startTempo = currentTempoRef.current;
  const endTempo = targetTempoRef.current;
  const progress = elapsedTime / duration;
  
  // Linear interpolation: start + progress * (end - start)
  const currentTempo = startTempo + progress * (endTempo - startTempo);
  return currentTempo;
};
```

### 3. Modified Beat Scheduling to Use Transitioning Tempo
Updated the `scheduleBeats` function to use the transitioning tempo when scheduling beats:
```typescript
// Advanced scheduling system for precise metronome timing
const scheduleBeats = () => {
  // Get current time
  const now = Date.now();
  
  // Schedule beats ahead of time (buffer of 4 beats)
  // This ensures we always have beats ready to play
  while (scheduledBeats.current.length < 4) {
    const lastScheduledBeat = scheduledBeats.current[scheduledBeats.current.length - 1];
    
    // If this is the first beat or we're not transitioning, use simple scheduling
    if (!lastScheduledBeat || tempoTransitionStartTimeRef.current === null) {
      // Calculate interval for current tempo
      const currentTempo = getCurrentTempo();
      const interval = (60 * 1000) / currentTempo;
      
      // ... rest of scheduling logic ...
    } else {
      // For transitioning tempo, calculate the exact time for the next beat
      // based on the tempo at that moment
      const nextBeatNumber = (lastScheduledBeat.beat + 1) % timeSignature.beats;
      
      // Estimate when the next beat should occur based on current tempo
      const currentTempo = getCurrentTempo();
      const interval = (60 * 1000) / currentTempo;
      const nextBeatTime = lastScheduledBeat.time + interval;
      
      scheduledBeats.current.push({
        time: nextBeatTime,
        beat: nextBeatNumber
      });
    }
  }
};
```

### 4. Updated BPM Change Handler to Start Tempo Transition
Modified the useEffect hook that handles BPM changes to start a gradual transition instead of abruptly changing the tempo:
```typescript
// Handle BPM or time signature changes
useEffect(() => {
  // Update target tempo when BPM changes
  targetTempoRef.current = bpm;
  
  if (isPlaying) {
    // For time signature changes, we need to reset completely
    if (timeSignature.beats !== scheduledBeats.current[0]?.beat) {
      // ... reset logic for time signature changes ...
    } 
    // For BPM changes, start a gradual transition
    else if (Math.abs(currentTempoRef.current - bpm) > 1) {
      // Start a new tempo transition
      tempoTransitionStartTimeRef.current = Date.now();
      
      // Don't clear scheduled beats - they'll be played with gradually changing tempo
      // Don't restart the processing interval - it's already running
      
      // The transition will happen in getCurrentTempo() which is called by scheduleBeats()
    }
  } else {
    // If not playing, just update the current tempo immediately
    currentTempoRef.current = bpm;
  }
}, [bpm, timeSignature]);
```

### 5. Updated Start/Stop Functions to Handle Tempo State
Updated the `startMetronome` and `stopMetronome` functions to properly initialize and reset the tempo transition state:

```typescript
// In startMetronome:
// Initialize tempo references
currentTempoRef.current = bpm;
targetTempoRef.current = bpm;
tempoTransitionStartTimeRef.current = null; // No transition in progress

// In stopMetronome:
// Reset tempo transition state
currentTempoRef.current = bpm;
targetTempoRef.current = bpm;
tempoTransitionStartTimeRef.current = null;
```

## Testing
To test the gradual tempo transition:
1. Start the metronome at a specific BPM (e.g., 120)
2. While it's playing, change the BPM (e.g., to 160 or 80)
3. Observe that the tempo changes gradually over about 1 second rather than abruptly

A test script (`test-metronome.js`) has been provided to help with manual testing.

## Future Improvements
Potential future improvements could include:
- Making the transition duration configurable
- Adding different transition curves (e.g., ease-in, ease-out)
- Visualizing the tempo transition in the UI