import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
      // Screen reads the safe-area insets through useSafeAreaInsets, which
      // throws without a provider rather than quietly reporting zero -- so the
      // test tree needs the one the app root supplies. Fixed metrics rather
      // than none: that is what the app passes too, and it is what stops a
      // screen drawing once unpadded and then dropping into place.
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        {/* The metro screen's sound/volume sheet is a BottomSheetModal, which
            throws ("BottomSheetModalInternalContext cannot be null") without
            this provider (app/_layout.tsx supplies it at the app root). */}
        <BottomSheetModalProvider>
          <PreferencesProvider>
            <PlaybackLockProvider>
              <MetronomeProvider>
                <Metro />
              </MetronomeProvider>
            </PlaybackLockProvider>
          </PreferencesProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
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
