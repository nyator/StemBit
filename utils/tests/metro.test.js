import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import Metro from '../../app/(tabs)/metro';
import { MetronomeProvider } from '../../context/MetronomeContext';
import { PlaybackLockProvider } from '../../context/PlaybackLockContext';
import { PreferencesProvider } from '../../context/PreferencesContext';


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

// Also backs PreferencesProvider, which reads/writes preferences.json.
// getInfoAsync reports "missing" so the provider falls through to its defaults.
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file://mock-documents/',
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  readAsStringAsync: jest.fn(() => Promise.resolve('bW9jay1iYXNlNjQ=')),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  EncodingType: { Base64: 'base64' },
}));

describe('<Metro />', () => {
  it('should start at 120 BPM and allow increasing the tempo', async () => {
    render(
      <PreferencesProvider>
        <PlaybackLockProvider>
          <MetronomeProvider>
            <Metro />
          </MetronomeProvider>
        </PlaybackLockProvider>
      </PreferencesProvider>
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
