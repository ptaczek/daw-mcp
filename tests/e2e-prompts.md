# DAW MCP End-to-End Tests

Interactive test prompts for validating the DAW MCP server. Run these in a Claude Code session with the MCP connected.

## Prerequisites

### Test Configuration

Create/update your config file with all tools enabled:

**Linux:** `~/.config/daw-mcp/config.json`
**macOS:** `~/Library/Application Support/daw-mcp/config.json`
**Windows:** `%APPDATA%\daw-mcp\config.json`

```json
{
  "defaultDaw": "bitwig",
  "bitwig": {
    "port": 8181,
    "gridResolution": 16,
    "cursorClipLengthBeats": 128,
    "scenes": 128
  },
  "ableton": {
    "port": 8182
  },
  "mcp": {
    "selectionDelayMs": 400,
    "requestTimeoutMs": 10000
  },
  "tools": {
    "batch_move_notes": true,
    "batch_set_note_properties": true,
    "transpose_clip": true,
    "transpose_range": true,
    "batch_create_tracks": true,
    "batch_delete_tracks": true,
    "batch_set_track_properties": true
  }
}
```

### Bitwig Test Project Setup

1. Create new project, save as `MCP-Test-Bitwig`
2. Create 4 instrument tracks named: `Test-1`, `Test-2`, `Test-3`, `Test-4`
3. Tracks 1-3: Add any melodic instrument (e.g., Polymer, FM-4)
4. Track 4: Add Drum Machine with standard mapping:
   - C1 (36): Kick
   - C#1 (37): Snare
   - D1 (38): Closed HH
   - D#1 (39): Open HH
5. Ensure clip launcher is visible (not arrangement view)
6. Leave all clip slots empty
7. Save project

### Ableton Test Project Setup

1. Create new Live Set, save as `MCP-Test-Ableton`
2. Create 4 MIDI tracks named: `Test-1`, `Test-2`, `Test-3`, `Test-4`
3. Tracks 1-3: Add any melodic instrument (e.g., Wavetable, Drift)
4. Track 4: Add Drum Rack with standard mapping:
   - C1 (36): Kick
   - F1 (41): Snare
   - F#1 (42): Closed HH
   - A#1 (46): Open HH
5. Ensure Session View is visible (not Arrangement)
6. Leave all clip slots empty
7. Save project

---

## Phase 1: Discovery & Connection

### Test 1.1: No DAW Connected

**Human action:** Close both Bitwig and Ableton

**Prompt:** "Check which DAWs are connected"

**Expected:**
- Both DAWs show `connected: false`
- Hint mentions no DAWs connected

---

### Test 1.2: Single DAW - Bitwig

**Human action:** Open Bitwig with `MCP-Test-Bitwig` project

**Prompt:** "Check which DAWs are connected"

**Expected:**
- Bitwig shows `connected: true`
- Ableton shows `connected: false`
- Hint mentions only Bitwig is connected, daw parameter optional

---

### Test 1.3: Single DAW - Ableton

**Human action:** Close Bitwig, open Ableton with `MCP-Test-Ableton` project

**Prompt:** "Check which DAWs are connected"

**Expected:**
- Bitwig shows `connected: false`
- Ableton shows `connected: true`
- Auto-selection should pick Ableton despite config default being Bitwig

---

### Test 1.4: Both DAWs Connected

**Human action:** Keep Ableton open, also open Bitwig with `MCP-Test-Bitwig`

**Prompt:** "Check which DAWs are connected"

**Expected:**
- Both show `connected: true`
- Hint mentions multiple DAWs, suggests using daw parameter
- Default DAW indicated

---

## Phase 2: Project & Track Operations

**Human action:** Ensure Bitwig is open with test project, close Ableton

### Test 2.1: Get Project Info

**Prompt:** "Get the current project info from the DAW"

**Expected:**
- BPM, time signature, playback state returned
- No errors

---

### Test 2.2: List Tracks

**Prompt:** "List all tracks in the project"

**Expected:**
- 4 tracks listed with 1-based indices (1, 2, 3, 4)
- Track names: Test-1, Test-2, Test-3, Test-4

---

### Test 2.3: Create Tracks

**Prompt:** "Create 2 new instrument tracks named 'Created-1' and 'Created-2'"

**Expected:**
- 2 tracks created successfully
- Created indices returned (5, 6)

**Verify in DAW:** Two new tracks appear at the end

---

### Test 2.4: Set Track Properties

**Prompt:** "Mute track 5 and solo track 6"

**Expected:**
- Success response
- Both operations completed

**Verify in DAW:** Track 5 is muted, track 6 is soloed

---

### Test 2.5: Delete Tracks

**Prompt:** "Delete tracks 5 and 6"

**Expected:**
- Success response
- Both tracks deleted

**Verify in DAW:** Only original 4 tracks remain

---

## Phase 3: Clip Operations

**Human action:** Select slot 1 on track 1 in Bitwig

### Test 3.1: Create Clip (Auto-find)

**Prompt:** "Create a new 4-beat clip on the cursor position"

**Expected:**
- Clip created successfully
- Returns trackIndex: 1, slotIndex: 1

**Verify in DAW:** Empty clip appears in track 1, slot 1

---

### Test 3.2: Create Clip (Specific Slot)

**Prompt:** "Create an 8-beat clip on track 2, slot 1, name it 'Test Clip'"

**Expected:**
- Clip created successfully
- Returns trackIndex: 2, slotIndex: 1, lengthInBeats: 8

**Verify in DAW:** Clip named "Test Clip" appears in track 2, slot 1

---

### Test 3.3: Create Clip (Occupied Slot - Should Fail)

**Prompt:** "Create a clip on track 2, slot 1"

**Expected:**
- Error: slot has content
- Suggests using overwrite=true

---

### Test 3.4: Create Clip (Overwrite)

**Prompt:** "Create a 16-beat clip on track 2, slot 1 with overwrite"

**Expected:**
- Success
- Old clip replaced

**Verify in DAW:** Clip in track 2, slot 1 is now 16 beats

---

### Test 3.5: List Clips

**Prompt:** "List all clips on track 1 and track 2"

**Expected:**
- Track 1: 1 clip at slot 1
- Track 2: 1 clip at slot 1
- Slot indices are 1-based

---

### Test 3.6: Set Clip Length

**Human action:** Select the clip on track 1, slot 1

**Prompt:** "Set the selected clip length to 8 beats"

**Expected:**
- Success response

**Verify in DAW:** Clip is now 8 beats long

---

### Test 3.7: Delete Clip

**Prompt:** "Delete the clip on track 2, slot 1"

**Expected:**
- Success response

**Verify in DAW:** Clip is gone from track 2, slot 1

---

## Phase 4: Note Operations

**Human action:** Select clip on track 1, slot 1

### Test 4.1: Set Notes (Lean Array Format)

**Prompt:** "Add the following notes to the selected clip: C3 at beat 0, E3 at beat 1, G3 at beat 2, C4 at beat 3. Use velocity 100 and duration 0.5 beats."

**Expected:**
- Notes: [[0, 60, 100, 0.5], [1, 64, 100, 0.5], [2, 67, 100, 0.5], [3, 72, 100, 0.5]]
- Success response

**Verify in DAW:** 4 notes visible in clip: C3, E3, G3, C4 at beats 0-3

---

### Test 4.2: Get Notes (Lean Format)

**Prompt:** "Read all notes from the selected clip"

**Expected:**
- 4 notes returned in lean format: [[x, y, velocity, duration], ...]
- Sorted by time

---

### Test 4.3: Get Notes (Verbose)

**Prompt:** "Read all notes from the selected clip with full properties"

**Expected:**
- 4 notes returned as objects with x, y, velocity, duration properties

---

### Test 4.4: Get Clip Stats

**Prompt:** "Get statistics for the selected clip"

**Expected:**
- noteCount: 4
- pitchRange: min 60, max 72
- pitchClasses: [0, 4, 7] (C, E, G)
- Analysis suggests C major

---

### Test 4.5: Move Notes

**Prompt:** "Move the note at beat 0, pitch 60 (C3) up by 2 semitones"

**Expected:**
- Success response

**Verify in DAW:** First note is now D3 (pitch 62)

---

### Test 4.6: Set Note Properties

**Prompt:** "Set the velocity of the note at beat 1, pitch 64 to 50"

**Expected:**
- Success response

**Verify in DAW:** Second note has lower velocity

---

### Test 4.7: Transpose Clip

**Prompt:** "Transpose all notes in the selected clip up by 12 semitones (one octave)"

**Expected:**
- Success response

**Verify in DAW:** All notes are now one octave higher

---

### Test 4.8: Transpose Range

**Prompt:** "Transpose notes between beat 2 and beat 3 down by 5 semitones"

**Expected:**
- Success, 2 notes transposed

**Verify in DAW:** Notes at beats 2-3 are lower pitched

---

### Test 4.9: Clear Specific Notes

**Prompt:** "Clear the note at beat 3"

**Expected:**
- Success, 1 note cleared

**Verify in DAW:** Only 3 notes remain

---

### Test 4.10: Clear All Notes

**Prompt:** "Clear all notes from the selected clip"

**Expected:**
- Success, all notes cleared

**Verify in DAW:** Clip is empty

---

## Phase 5: Euclidean Patterns

### Test 5.1: Create Euclidean Pattern (New Clip) - Bitwig

**Human action:** Ensure Bitwig is open, Ableton closed

**Prompt:** "Create a euclidean drum pattern on track 4 with: kick (C1/36) 4 hits in 16 steps, closed hihat (D1/38) 7 hits in 16 steps, snare (C#1/37) 2 hits in 16 steps rotated by 4"

**Expected:**
- New clip created on track 4
- Pattern generated with notes at pitches 36, 37, 38

**Verify in DAW:** Clip with rhythmic drum pattern appears on track 4, sounds like a basic beat

---

### Test 5.2: Create Euclidean Pattern (Existing Clip)

**Human action:** Select the clip created in test 5.1

**Prompt:** "Add a euclidean pattern to the selected clip: open hihat (D#1/39) 3 hits in 8 steps"

**Expected:**
- Pattern added to existing clip
- Only D#1 notes cleared before adding

**Verify in DAW:** Open hihat pattern added, kick/snare/closed hihat preserved

---

### Test 5.3: Create Euclidean Pattern - Ableton

**Human action:** Close Bitwig, open Ableton with test project

**Prompt:** "Create a euclidean drum pattern on track 4 with: kick (C1/36) 4 hits in 16 steps, closed hihat (F#1/42) 5 hits in 16 steps, snare (F1/41) 2 hits in 16 steps rotated by 4"

**Expected:**
- New clip created on track 4 in Ableton
- Pattern uses Ableton's drum mapping

**Verify in DAW:** Clip with rhythmic drum pattern appears, sounds correct with Ableton's drum rack

---

## Phase 6: Cross-DAW Operations

**Human action:** Open both Bitwig and Ableton with their test projects

### Test 6.1: Explicit DAW Selection - Bitwig

**Prompt:** "Get project info from Bitwig specifically"

**Expected:**
- Uses daw: "bitwig" parameter
- Returns Bitwig project info

---

### Test 6.2: Explicit DAW Selection - Ableton

**Prompt:** "Get project info from Ableton specifically"

**Expected:**
- Uses daw: "ableton" parameter
- Returns Ableton project info

---

### Test 6.3: Create Clip in Non-Default DAW

**Prompt:** "Create a clip on track 1, slot 2 in Ableton"

**Expected:**
- Clip created in Ableton, not Bitwig

**Verify in Ableton:** Clip appears in track 1, slot 2

---

### Test 6.4: Auto-Selection with Single DAW

**Human action:** Close Ableton, keep Bitwig open

**Prompt:** "Create a clip on track 1, slot 3"

**Expected:**
- Auto-selects Bitwig (only connected DAW)
- Clip created in Bitwig despite Ableton being config default

**Verify in Bitwig:** Clip appears in track 1, slot 3

---

## Phase 7: Error Handling

### Test 7.1: No DAW Connected

**Human action:** Close both DAWs

**Prompt:** "List all tracks"

**Expected:**
- Connection error
- Helpful message about starting DAW with extension

---

### Test 7.2: Invalid Track Index

**Human action:** Open Bitwig with test project (4 tracks)

**Prompt:** "Create a clip on track 99, slot 1"

**Expected:**
- Error about invalid track index

---

### Test 7.3: No Clip Selected

**Human action:** Deselect any clip (click empty area)

**Prompt:** "Get notes from the selected clip"

**Expected:**
- Error about no clip selected
- Suggests selecting in DAW or providing indices

---

## Cleanup

**Human action:**
1. Delete any clips created during testing
2. Save both test projects
3. Close DAWs if done testing

---

## Test Results Summary

| Phase | Tests | Passed | Failed | Notes |
|-------|-------|--------|--------|-------|
| 1. Discovery | 4 | | | |
| 2. Project & Tracks | 5 | | | |
| 3. Clips | 7 | | | |
| 4. Notes | 10 | | | |
| 5. Euclidean | 3 | | | |
| 6. Cross-DAW | 4 | | | |
| 7. Errors | 3 | | | |
| **Total** | **36** | | | |
