import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Metro from '../../app/(tabs)/metro';
import { MetronomeProvider, METRONOME_SOUNDS } from '../../context/MetronomeContext';
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
      // The metro screen's sound/volume sheet is a BottomSheetModal, which
      // throws ("BottomSheetModalInternalContext cannot be null") without this
      // provider (app/_layout.tsx supplies it at the app root).
      <BottomSheetModalProvider>
        <PreferencesProvider>
          <PlaybackLockProvider>
            <MetronomeProvider>
              <Metro />
            </MetronomeProvider>
          </PlaybackLockProvider>
        </PreferencesProvider>
      </BottomSheetModalProvider>
    );
    await waitFor(() => {
      // The engine decodes every registered click up front, one Asset.fromModule
      // per sound (see MetronomeProvider's loadEngine).
      expect(require('expo-asset').Asset.fromModule).toHaveBeenCalledTimes(
        METRONOME_SOUNDS.length
      );
    });

    expect(screen.getByDisplayValue('120')).toBeTruthy();
    
    const increaseButton = screen.getByLabelText('Increase BPM');
    fireEvent.press(increaseButton);

    expect(screen.getByDisplayValue('121')).toBeTruthy();
  });
});
