import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import Metro from '../../app/(tabs)/metro';

jest.mock('@expo/vector-icons/AntDesign', () => 'AntDesign');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');

// Mock the audio module to prevent errors during testing in a Node environment
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    replace: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    loop: false,
    playbackRate: 1,
  })),
}));

describe('<Metro />', () => {
  it('should start at 120 BPM and allow increasing the tempo', async () => {
    render(<Metro />);
    await waitFor(() => {
      expect(require('expo-audio').createAudioPlayer).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByDisplayValue('120')).toBeTruthy();

    const increaseButton = screen.getByLabelText('Increase BPM');
    fireEvent.press(increaseButton);

    expect(screen.getByDisplayValue('121')).toBeTruthy();
  });
});
