import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import Metro from '../../app/(tabs)/metro';
import { MetronomeProvider } from '../../context/MetronomeContext';

jest.mock('@expo/vector-icons/AntDesign', () => 'AntDesign');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');

// The metronome's timing engine runs inside a WebView (see
// constants/metronomeEngine.ts) — mock it out along with the asset loading
// it depends on so tests can run in a Node environment.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ postMessage: jest.fn() }));
    return null;
  });
  return { __esModule: true, default: WebView };
});

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: jest.fn(() => Promise.resolve()),
      localUri: 'file://mock-click.wav',
    })),
  },
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('bW9jay1iYXNlNjQ=')),
  EncodingType: { Base64: 'base64' },
}));

describe('<Metro />', () => {
  it('should start at 120 BPM and allow increasing the tempo', async () => {
    render(
      <MetronomeProvider>
        <Metro />
      </MetronomeProvider>
    );
    await waitFor(() => {
      expect(require('expo-asset').Asset.fromModule).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByDisplayValue('120')).toBeTruthy();

    const increaseButton = screen.getByLabelText('Increase BPM');
    fireEvent.press(increaseButton);

    expect(screen.getByDisplayValue('121')).toBeTruthy();
  });
});
