import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import Metro from './metro'; // Assuming your component is in metro.tsx

// Mock the audio module to prevent errors during testing in a Node environment
jest.mock('expo-av', () => {
  const { Audio } = jest.requireActual('expo-av');
  return {
    Audio: {
      ...Audio,
      Sound: {
        createAsync: jest.fn(() =>
          Promise.resolve({
            sound: {
              playAsync: jest.fn(),
              stopAsync: jest.fn(),
              unloadAsync: jest.fn(),
              setOnPlaybackStatusUpdate: jest.fn(),
            },
            status: {},
          })
        ),
      },
    },
  };
});

describe('<Metro />', () => {
  it('should start at 120 BPM and allow increasing the tempo', () => {
    render(<Metro />);

    // Check for the initial BPM
    const bpmText = screen.getByText('120');
    expect(bpmText).toBeVisible();

    // Find the "+" button by its accessibility label (you might need to add one)
    // For example: <TouchableOpacity accessibilityLabel="Increase BPM" ... >
    const increaseButton = screen.getByLabelText('Increase BPM');
    fireEvent.press(increaseButton);

    // Check if the BPM has increased. Let's assume it increases by 1.
    expect(screen.getByText('121')).toBeVisible();
  });
});
