// Whether a build has native audio, asked the way Expo Go needs it asked.
//
// Expo Go has no react-native-audio-api, and in development Metro answers a
// require of it by reporting the failure and returning undefined rather than
// throwing -- which read as "available" and sent every engine down the native
// path. The registry check is what decides now, before anything is required.

describe("isNativeAudioAvailable", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.dontMock("react-native-audio-api");
    jest.restoreAllMocks();
  });

  const withRegistry = (registered) => {
    const ReactNative = require("react-native");
    const get = jest
      .spyOn(ReactNative.TurboModuleRegistry, "get")
      .mockImplementation((name) =>
        registered && name === "AudioAPIModule" ? {} : null
      );
    jest.spyOn(console, "warn").mockImplementation(() => {});
    return { get, nativeAudio: require("../nativeAudio") };
  };

  it("says no without loading the library when the module isn't registered", () => {
    let required = false;
    jest.doMock("react-native-audio-api", () => {
      required = true;
      return {};
    });
    const { nativeAudio } = withRegistry(false);

    expect(nativeAudio.isNativeAudioAvailable()).toBe(false);
    expect(required).toBe(false);
    expect(() => nativeAudio.getAudioApi()).toThrow("not in this build");
  });

  it("asks once, not on every call", () => {
    const { get, nativeAudio } = withRegistry(false);
    nativeAudio.isNativeAudioAvailable();
    nativeAudio.isNativeAudioAvailable();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("says no when the require hands back nothing", () => {
    jest.doMock("react-native-audio-api", () => undefined);
    const { nativeAudio } = withRegistry(true);
    expect(nativeAudio.isNativeAudioAvailable()).toBe(false);
  });

  it("says yes when the module is there", () => {
    const { nativeAudio } = withRegistry(true);
    expect(nativeAudio.isNativeAudioAvailable()).toBe(true);
  });
});
