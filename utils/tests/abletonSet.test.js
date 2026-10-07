/**
 * Reading an Ableton Live Set for its locators, tempo and clip placements.
 *
 * Sets are written out here as the XML Live saves, trimmed to the elements the
 * reader looks at, rather than committed as .als fixtures -- for the same
 * reason the WAV marker tests build their files byte by byte: a fixture would
 * only prove the reader agrees with whichever version of Live saved it. The
 * element paths below are the ones Live 10, 11 and 12 write.
 */

const { gzipSync, strToU8 } = require("fflate");

const {
  beatsToSeconds,
  matchKey,
  parseAbletonSet,
  parseAbletonSetXml,
  placementFor,
  sectionsFromLocators,
} = require("../abletonSet");

// ---- set construction --------------------------------------------------------

function locator({ time, name = "", songStart = false }) {
  return `
    <Locator Id="0">
      <LomId Value="0" />
      <Time Value="${time}" />
      <Name Value="${name}" />
      <Annotation Value="" />
      <IsSongStart Value="${songStart}" />
    </Locator>`;
}

function master({ bpm = 120, track = "MasterTrack", tempoEvents } = {}) {
  const envelope = tempoEvents
    ? `
      <AutomationEnvelopes>
        <Envelopes>
          <AutomationEnvelope Id="0">
            <EnvelopeTarget><PointeeId Value="8" /></EnvelopeTarget>
            <Automation>
              <Events>
                ${tempoEvents
                  .map(
                    ([time, value], i) =>
                      `<FloatEvent Id="${i}" Time="${time}" Value="${value}" />`
                  )
                  .join("\n")}
              </Events>
            </Automation>
          </AutomationEnvelope>
        </Envelopes>
      </AutomationEnvelopes>`
    : "<AutomationEnvelopes><Envelopes /></AutomationEnvelopes>";

  return `
    <${track}>
      ${envelope}
      <DeviceChain>
        <Mixer>
          <Tempo>
            <LomId Value="0" />
            <Manual Value="${bpm}" />
            <AutomationTarget Id="8"><LockEnvelope Value="0" /></AutomationTarget>
          </Tempo>
        </Mixer>
      </DeviceChain>
    </${track}>`;
}

function audioClip({
  time,
  file,
  live10 = false,
  loopStart = 0,
  startRelative = 0,
  warped = false,
  markers = [],
}) {
  const fileRef = live10
    ? `<FileRef><RelativePath><RelativePathElement Dir="Samples" /></RelativePath><Name Value="${file}" /></FileRef>`
    : `<FileRef><RelativePath Value="Samples/Imported/${file}" /><Path Value="C:/Users/someone/Music/Song Project/Samples/Imported/${file}" /></FileRef>`;
  return `
    <AudioClip Id="0" Time="${time}">
      <CurrentStart Value="${time}" />
      <Loop>
        <LoopStart Value="${loopStart}" />
        <LoopEnd Value="${loopStart + 64}" />
        <StartRelative Value="${startRelative}" />
        <LoopOn Value="false" />
      </Loop>
      <Name Value="ignored clip name" />
      <SampleRef>${fileRef}</SampleRef>
      <IsWarped Value="${warped}" />
      <WarpMarkers>
        ${markers
          .map(([beat, sec], i) => `<WarpMarker Id="${i}" SecTime="${sec}" BeatTime="${beat}" />`)
          .join("\n")}
      </WarpMarkers>
    </AudioClip>`;
}

function audioTrack({ arrangement = [], session = [], frozen = [] }) {
  return `
    <AudioTrack Id="1">
      <DeviceChain>
        <MainSequencer>
          <ClipSlotList>
            <ClipSlot><ClipSlot><Value>${session.map(audioClip).join("")}</Value></ClipSlot></ClipSlot>
          </ClipSlotList>
          <Sample>
            <ArrangerAutomation>
              <Events>${arrangement.map(audioClip).join("")}</Events>
            </ArrangerAutomation>
          </Sample>
        </MainSequencer>
        <FreezeSequencer>
          <Sample>
            <ArrangerAutomation>
              <Events>${frozen.map(audioClip).join("")}</Events>
            </ArrangerAutomation>
          </Sample>
        </FreezeSequencer>
      </DeviceChain>
    </AudioTrack>`;
}

function set({ locators = [], tracks = [], masterTrack = master() } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="11.0_11300" Creator="Ableton Live 11.3">
  <LiveSet>
    <Tracks>${tracks.map(audioTrack).join("")}</Tracks>
    ${masterTrack}
    <Locators><Locators>${locators.map(locator).join("")}</Locators></Locators>
  </LiveSet>
</Ableton>`;
}

// ---- tests -------------------------------------------------------------------

describe("locators", () => {
  it("turns locator beats into seconds at the set's tempo", () => {
    const parsed = parseAbletonSetXml(
      set({
        masterTrack: master({ bpm: 120 }),
        locators: [
          { time: 0, name: "Intro" },
          { time: 16, name: "Verse" }, // 16 beats at 120 = 8s
          { time: 48, name: "Chorus" }, // 24s
        ],
      })
    );

    expect(parsed.bpm).toBe(120);
    expect(parsed.locators).toEqual([
      { name: "Intro", seconds: 0 },
      { name: "Verse", seconds: 8 },
      { name: "Chorus", seconds: 24 },
    ]);
  });

  it("returns them in playing order, not the order they were saved in", () => {
    const parsed = parseAbletonSetXml(
      set({
        locators: [
          { time: 64, name: "Bridge" },
          { time: 0, name: "Intro" },
          { time: 32, name: "Chorus" },
        ],
      })
    );
    expect(parsed.locators.map((l) => l.name)).toEqual(["Intro", "Chorus", "Bridge"]);
  });

  it("skips Live 11's song-start marker, which is not a section", () => {
    const parsed = parseAbletonSetXml(
      set({
        locators: [
          { time: 4, name: "", songStart: true },
          { time: 8, name: "Verse" },
        ],
      })
    );
    expect(parsed.locators.map((l) => l.name)).toEqual(["Verse"]);
  });

  it("decodes names with escaped characters", () => {
    const parsed = parseAbletonSetXml(
      set({ locators: [{ time: 0, name: "Verse &amp; Pre &quot;1&quot;" }] })
    );
    expect(parsed.locators[0].name).toBe('Verse & Pre "1"');
  });

  it("reads the tempo from Live 12's renamed master track", () => {
    const parsed = parseAbletonSetXml(
      set({
        masterTrack: master({ bpm: 90, track: "MainTrack" }),
        locators: [{ time: 3, name: "Verse" }], // 3 beats at 90 = 2s
      })
    );
    expect(parsed.bpm).toBe(90);
    expect(parsed.locators[0].seconds).toBeCloseTo(2, 6);
  });
});

describe("tempo automation", () => {
  it("follows a tempo change, ignoring the manual value it overrides", () => {
    const parsed = parseAbletonSetXml(
      set({
        masterTrack: master({
          bpm: 999, // what the knob says; the envelope is what plays
          tempoEvents: [
            [-63072000, 120], // Live's "value before any breakpoint"
            [16, 120],
            [16, 60], // a jump at beat 16
          ],
        }),
        locators: [
          { time: 16, name: "Slow" }, // 8s
          { time: 20, name: "Later" }, // + 4 beats at 60 = 12s
        ],
      })
    );

    expect(parsed.bpm).toBe(120);
    expect(parsed.locators[0].seconds).toBeCloseTo(8, 6);
    expect(parsed.locators[1].seconds).toBeCloseTo(12, 6);
  });

  it("integrates a ramp rather than averaging its ends", () => {
    // 60 -> 120 bpm across 4 beats takes 4 * ln(2) seconds. Averaging to 90
    // would say 2.667s -- close enough to look right, wrong enough to land a
    // late section on the wrong beat.
    const tempo = [
      { beat: 0, bpm: 60 },
      { beat: 4, bpm: 120 },
    ];
    expect(beatsToSeconds(4, tempo)).toBeCloseTo(4 * Math.log(2), 9);
    // And holds the last tempo after the last breakpoint: 4 more beats at 120.
    expect(beatsToSeconds(8, tempo)).toBeCloseTo(4 * Math.log(2) + 2, 9);
  });

  it("holds the first tempo before the first breakpoint", () => {
    expect(beatsToSeconds(4, [{ beat: 8, bpm: 60 }])).toBe(4);
  });
});

describe("clip placement", () => {
  it("places a file by where its arrangement clip starts", () => {
    const parsed = parseAbletonSetXml(
      set({
        tracks: [
          { arrangement: [{ time: 0, file: "Drums.wav" }] },
          { arrangement: [{ time: 32, file: "Strings.wav" }] }, // bar 9 at 120 = 16s
        ],
      })
    );
    expect(parsed.clips).toEqual([
      { fileName: "Drums.wav", startSeconds: 0 },
      { fileName: "Strings.wav", startSeconds: 16 },
    ]);
  });

  it("names the file from Live 10's Name as well as later versions' paths", () => {
    const parsed = parseAbletonSetXml(
      set({ tracks: [{ arrangement: [{ time: 0, file: "Bass.aif", live10: true }] }] })
    );
    expect(parsed.clips[0].fileName).toBe("Bass.aif");
  });

  it("backs a trimmed clip up to where its file starts", () => {
    // Unwarped: clip time is seconds into the file. Placed at 10s and starting
    // 2s into its file, the file itself begins at 8s.
    const parsed = parseAbletonSetXml(
      set({
        tracks: [{ arrangement: [{ time: 20, file: "Vox.wav", loopStart: 2 }] }],
      })
    );
    expect(parsed.clips[0].startSeconds).toBeCloseTo(8, 6);
  });

  it("maps a warped clip's start through its warp markers", () => {
    // Clip starts at beat 4 of its own time, which the markers put 1.5s into
    // the file (beat 0 = 0.5s, beat 8 = 2.5s, so beat 4 = 1.5s).
    const parsed = parseAbletonSetXml(
      set({
        tracks: [
          {
            arrangement: [
              {
                time: 8, // 4s on the song
                file: "Keys.wav",
                warped: true,
                loopStart: 4,
                markers: [
                  [0, 0.5],
                  [8, 2.5],
                ],
              },
            ],
          },
        ],
      })
    );
    expect(parsed.clips[0].startSeconds).toBeCloseTo(4 - 1.5, 6);
  });

  it("ignores session-view and frozen clips, which the arrangement doesn't play", () => {
    const parsed = parseAbletonSetXml(
      set({
        tracks: [
          {
            session: [{ time: 0, file: "Jam.wav" }],
            frozen: [{ time: 0, file: "Freeze Drums.wav" }],
            arrangement: [{ time: 4, file: "Drums.wav" }],
          },
        ],
      })
    );
    expect(parsed.clips.map((c) => c.fileName)).toEqual(["Drums.wav"]);
  });

  it("places a file used by several clips by the earliest", () => {
    const parsed = parseAbletonSetXml(
      set({
        tracks: [
          {
            arrangement: [
              { time: 64, file: "Vox.wav", loopStart: 32 },
              { time: 16, file: "Vox.wav" },
            ],
          },
        ],
      })
    );
    expect(parsed.clips).toEqual([{ fileName: "Vox.wav", startSeconds: 8 }]);
  });

  it("matches files to clips without regard to case or extension", () => {
    const parsed = parseAbletonSetXml(
      set({ tracks: [{ arrangement: [{ time: 32, file: "Strings.wav" }] }] })
    );
    expect(placementFor(parsed, "strings.WAV")).toBe(16);
    expect(placementFor(parsed, "Strings.mp3")).toBe(16);
    // Rendered with Export Audio: a new file the set never used.
    expect(placementFor(parsed, "1-Strings.wav")).toBeUndefined();
    expect(matchKey("C:\\stems\\01 Drums.WAV")).toBe("01 drums");
  });
});

describe("sections from locators", () => {
  it("runs each to the next and leaves the last open", () => {
    const sections = sectionsFromLocators([
      { name: "Intro", seconds: 0 },
      { name: "Verse", seconds: 8 },
      { name: "Chorus", seconds: 24 },
    ]);
    expect(sections.map(({ name, startSeconds, endSeconds }) => ({ name, startSeconds, endSeconds }))).toEqual([
      { name: "Intro", startSeconds: 0, endSeconds: 8 },
      { name: "Verse", startSeconds: 8, endSeconds: 24 },
      { name: "Chorus", startSeconds: 24, endSeconds: undefined },
    ]);
    expect(new Set(sections.map((s) => s.id)).size).toBe(3);
  });

  it("names unnamed locators and merges ones on the same spot", () => {
    const sections = sectionsFromLocators([
      { name: "", seconds: 0 },
      { name: "Verse", seconds: 8 },
      { name: "Verse copy", seconds: 8 },
    ]);
    expect(sections.map((s) => s.name)).toEqual(["Section 1", "Verse"]);
  });
});

describe("reading the file", () => {
  it("unzips a set the way Live saves it", () => {
    const xml = set({ locators: [{ time: 16, name: "Verse" }] });
    const parsed = parseAbletonSet(gzipSync(strToU8(xml)));
    expect(parsed.locators).toEqual([{ name: "Verse", seconds: 8 }]);
  });

  it("accepts a set someone unzipped and saved as plain XML", () => {
    const xml = set({ locators: [{ time: 16, name: "Verse" }] });
    expect(parseAbletonSet(strToU8(xml)).locators).toHaveLength(1);
  });

  it("has nothing to say about a file that isn't a set", () => {
    const empty = { bpm: 0, locators: [], clips: [] };
    expect(parseAbletonSet(new Uint8Array([1, 2, 3]))).toEqual(empty);
    // Gzip magic, then garbage: the inflate fails and that is not a crash.
    expect(parseAbletonSet(new Uint8Array([0x1f, 0x8b, 9, 9, 9]))).toEqual(empty);
    expect(parseAbletonSetXml("<html><body>hi</body></html>")).toEqual(empty);
  });

  it("keeps going through a close tag that doesn't match", () => {
    const xml = set({ locators: [{ time: 16, name: "Verse" }] }).replace(
      "<Tracks>",
      "<Tracks></Stray>"
    );
    expect(parseAbletonSetXml(xml).locators).toHaveLength(1);
  });
});
