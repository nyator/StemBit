import ExpoModulesCore
import AVFoundation
import AVKit
import UIKit

// iOS side of the audio-routes module. See ../index.ts for why selection is
// deliberately limited here -- the short version is that Apple does not let an
// app route audio to a specific Bluetooth or AirPlay device, so the system
// route picker is the real control and this module's job is mostly to report
// what's connected.
public class AudioRoutesModule: Module {
  // Synthetic id for the built-in speaker. AVAudioSession only hands out a uid
  // for a port that's part of the *current* route, but the speaker is always a
  // destination whether or not it's the one in use, so it needs an id that
  // doesn't depend on being active.
  private static let speakerId = "builtInSpeaker"

  private var routeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("AudioRoutes")

    Events("onRouteChange")

    Function("getOutputs") { () -> [[String: Any]] in
      AudioRoutesModule.currentOutputs()
    }

    AsyncFunction("selectOutput") { (id: String) -> Bool in
      let session = AVAudioSession.sharedInstance()

      // overrideOutputAudioPort throws outside playAndRecord. Checking up front
      // keeps a predictable `false` rather than surfacing a session error for
      // something that was never going to work.
      guard session.category == .playAndRecord else {
        return false
      }

      do {
        if id == AudioRoutesModule.speakerId {
          try session.overrideOutputAudioPort(.speaker)
        } else {
          // .none doesn't mean "no output" -- it clears our override and lets
          // the system route to whatever it considers preferred, which is the
          // connected accessory.
          try session.overrideOutputAudioPort(.none)
        }
        return true
      } catch {
        return false
      }
    }

    Function("showOutputPicker") { () -> Bool in
      DispatchQueue.main.async {
        AudioRoutesModule.presentRoutePicker()
      }
      return true
    }

    OnStartObserving {
      guard self.routeObserver == nil else { return }
      self.routeObserver = NotificationCenter.default.addObserver(
        forName: AVAudioSession.routeChangeNotification,
        object: AVAudioSession.sharedInstance(),
        queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onRouteChange", ["outputs": AudioRoutesModule.currentOutputs()])
      }
    }

    OnStopObserving {
      if let observer = self.routeObserver {
        NotificationCenter.default.removeObserver(observer)
        self.routeObserver = nil
      }
    }
  }

  // MARK: - Route reporting

  private static func currentOutputs() -> [[String: Any]] {
    let session = AVAudioSession.sharedInstance()
    // Selection only ever works in playAndRecord; reporting it per-output lets
    // the UI hide a control it can't honour instead of failing on tap.
    let selectable = session.category == .playAndRecord

    var outputs: [[String: Any]] = []
    var speakerIsActive = false

    for port in session.currentRoute.outputs {
      if port.portType == .builtInSpeaker {
        speakerIsActive = true
        continue
      }
      outputs.append([
        "id": port.uid,
        "name": port.portName,
        "kind": kind(for: port.portType),
        "isActive": true,
        "isSelectable": selectable,
      ])
    }

    // Listed unconditionally and first: the speaker is always available, and a
    // list that dropped it whenever headphones were in would be odd.
    outputs.insert([
      "id": speakerId,
      "name": "Phone Speaker",
      "kind": "speaker",
      "isActive": speakerIsActive,
      "isSelectable": selectable,
    ], at: 0)

    return outputs
  }

  private static func kind(for portType: AVAudioSession.Port) -> String {
    switch portType {
    case .builtInSpeaker: return "speaker"
    case .builtInReceiver: return "receiver"
    case .headphones, .headsetMic: return "wiredHeadset"
    case .bluetoothA2DP: return "bluetoothA2dp"
    case .bluetoothHFP, .bluetoothLE: return "bluetoothSco"
    case .usbAudio: return "usb"
    case .HDMI: return "hdmi"
    case .airPlay: return "airplay"
    case .carAudio: return "carAudio"
    default: return "unknown"
    }
  }

  // MARK: - System route picker

  // AVRoutePickerView has no programmatic "present" API -- the supported way to
  // trigger it is to tap its button. The view has to be in the hierarchy for
  // that to take effect, so it's added transparently, tapped, and removed once
  // the system sheet has had time to take over.
  private static func presentRoutePicker() {
    guard let window = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .flatMap({ $0.windows })
      .first(where: { $0.isKeyWindow })
    else { return }

    let picker = AVRoutePickerView(frame: .zero)
    // Transparent rather than hidden: a hidden view doesn't deliver actions.
    picker.alpha = 0
    window.addSubview(picker)

    for subview in picker.subviews {
      if let button = subview as? UIButton {
        button.sendActions(for: .touchUpInside)
        break
      }
    }

    DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
      picker.removeFromSuperview()
    }
  }
}
