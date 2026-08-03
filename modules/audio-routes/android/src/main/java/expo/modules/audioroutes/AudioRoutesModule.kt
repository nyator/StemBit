package expo.modules.audioroutes

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android side of the audio-routes module. Unlike iOS, enumeration here is
// real and complete -- AudioManager will tell us every connected output. What
// it won't do is let us pin media playback to one of them: expo-audio owns the
// ExoPlayer instance, so there's no audio track for us to call
// setPreferredDevice on. Selection therefore reports false and the UI sends the
// user to the system output switcher instead.
class AudioRoutesModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private var deviceCallback: AudioDeviceCallback? = null

  override fun definition() = ModuleDefinition {
    Name("AudioRoutes")

    Events("onRouteChange")

    Function("getOutputs") {
      outputs()
    }

    AsyncFunction("selectOutput") { _: String ->
      // Deliberately always false -- see the note at the top of the class.
      // Reporting an honest failure is better than switching the radio button
      // while the audio keeps coming out of the old device.
      false
    }

    Function("showOutputPicker") {
      showPicker()
    }

    OnStartObserving { startObserving() }

    OnStopObserving { stopObserving() }
  }

  // MARK: - Route reporting

  private fun outputs(): List<Map<String, Any?>> {
    val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    val activeId = activeOutputId(devices)

    val mapped = devices.mapNotNull { device ->
      val kind = kindFor(device) ?: return@mapNotNull null
      mapOf(
        "id" to device.id.toString(),
        "name" to labelFor(device, kind),
        "kind" to kind,
        "isActive" to (device.id == activeId),
        "isSelectable" to false,
        "rank" to rankFor(kind),
      )
    }

    // A single pair of earbuds shows up twice -- once as A2DP (stereo media)
    // and once as SCO (hands-free voice). They're one device to the user, so
    // they collapse to one row, keeping the A2DP entry since that's the one
    // media actually plays through.
    val byName = LinkedHashMap<String, Map<String, Any?>>()
    for (entry in mapped) {
      val name = entry["name"] as String
      val existing = byName[name]
      val replaces = existing != null &&
        existing["kind"] == "bluetoothSco" &&
        entry["kind"] == "bluetoothA2dp"
      if (existing == null || replaces) {
        byName[name] = entry
      }
    }

    return byName.values
      .sortedBy { it["rank"] as Int }
      .map { it - "rank" }
  }

  private fun activeOutputId(devices: Array<AudioDeviceInfo>): Int? {
    // Android 12+ can answer this directly for a given usage. It's wrapped
    // because the call has moved between system/public API across versions and
    // a throw here shouldn't cost us the whole device list.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        val attributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build()
        val activeType = audioManager.getAudioDevicesForAttributes(attributes)
          .firstOrNull()
          ?.type
        if (activeType != null) {
          devices.firstOrNull { it.type == activeType }?.let { return it.id }
        }
      } catch (_: Throwable) {
        // Fall through to the heuristic below.
      }
    }

    // Older versions don't expose the routing decision, so we mirror it: media
    // follows the highest-priority connected output, with the speaker last.
    val priority = listOf(
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
      AudioDeviceInfo.TYPE_USB_HEADSET,
      AudioDeviceInfo.TYPE_USB_DEVICE,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_HDMI,
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,
    )
    for (type in priority) {
      devices.firstOrNull { it.type == type }?.let { return it.id }
    }
    return devices.firstOrNull()?.id
  }

  // Returns null for device types that aren't a destination the user would
  // recognise (telephony, the always-present "remote submix", and so on).
  private fun kindFor(device: AudioDeviceInfo): String? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      device.type == AudioDeviceInfo.TYPE_BLE_HEADSET
    ) {
      return "bluetoothA2dp"
    }
    return when (device.type) {
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "receiver"
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
      AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wiredHeadset"
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "bluetoothA2dp"
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetoothSco"
      AudioDeviceInfo.TYPE_USB_DEVICE,
      AudioDeviceInfo.TYPE_USB_HEADSET,
      AudioDeviceInfo.TYPE_USB_ACCESSORY -> "usb"
      AudioDeviceInfo.TYPE_HDMI,
      AudioDeviceInfo.TYPE_HDMI_ARC -> "hdmi"
      AudioDeviceInfo.TYPE_DOCK -> "dock"
      else -> null
    }
  }

  private fun labelFor(device: AudioDeviceInfo, kind: String): String {
    val product = device.productName?.toString()?.trim().orEmpty()
    return when (kind) {
      // Built-in and wired outputs report the phone's own model name as their
      // product name, which is noise -- "Pixel 8" is not a useful label for the
      // loudspeaker. Fixed labels read better.
      "speaker" -> "Phone Speaker"
      "receiver" -> "Earpiece"
      "wiredHeadset" -> "Wired Headphones"
      "hdmi" -> "HDMI"
      "dock" -> "Dock"
      // Bluetooth and USB accessories report their own name, which is exactly
      // how the user tells one pair of earbuds from another.
      else -> product.ifEmpty {
        when (kind) {
          "bluetoothA2dp", "bluetoothSco" -> "Bluetooth Device"
          "usb" -> "USB Audio Device"
          else -> "Audio Device"
        }
      }
    }
  }

  // Display order: the phone's own speaker first, then accessories.
  private fun rankFor(kind: String): Int = when (kind) {
    "speaker" -> 0
    "receiver" -> 1
    "wiredHeadset" -> 2
    "bluetoothA2dp" -> 3
    "bluetoothSco" -> 4
    "usb" -> 5
    "hdmi" -> 6
    "dock" -> 7
    else -> 8
  }

  // MARK: - Observing

  private fun startObserving() {
    if (deviceCallback != null) return
    val callback = object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
        emitRouteChange()
      }

      override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) {
        emitRouteChange()
      }
    }
    audioManager.registerAudioDeviceCallback(callback, Handler(Looper.getMainLooper()))
    deviceCallback = callback
  }

  private fun stopObserving() {
    deviceCallback?.let { audioManager.unregisterAudioDeviceCallback(it) }
    deviceCallback = null
  }

  private fun emitRouteChange() {
    sendEvent("onRouteChange", mapOf("outputs" to outputs()))
  }

  // MARK: - System output switcher

  private fun showPicker(): Boolean {
    // The media output panel is the switcher users see from the volume slider;
    // it's the closest equivalent to iOS's route picker. Older versions fall
    // back to the sound settings screen.
    val candidates = mutableListOf<Intent>()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      candidates.add(Intent("android.settings.panel.action.MEDIA_OUTPUT"))
    }
    candidates.add(Intent(Settings.ACTION_SOUND_SETTINGS))
    candidates.add(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))

    for (intent in candidates) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        return true
      } catch (_: Throwable) {
        // Try the next one.
      }
    }
    return false
  }
}
