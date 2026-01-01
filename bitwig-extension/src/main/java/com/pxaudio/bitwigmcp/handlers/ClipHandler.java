package com.pxaudio.bitwigmcp.handlers;

import com.bitwig.extension.controller.api.*;
import com.google.gson.*;

import com.pxaudio.bitwigmcp.BitwigMCPExtension;


/**
 * Handles clip operations: list, create, delete, and MIDI note manipulation.
 */
public class ClipHandler {
    private final BitwigMCPExtension extension;
    private final ControllerHost host;

    public ClipHandler(BitwigMCPExtension extension, ControllerHost host) {
        this.extension = extension;
        this.host = host;
    }

    /**
     * Get the cursor clip - follows user's selection in Bitwig UI.
     */
    private Clip getClip() {
        return extension.getCursorClip();
    }

    private static JsonObject successResponse() {
        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        return result;
    }

    private static String midiNoteToName(int midiNote) {
        String[] noteNames = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
        // Bitwig uses MIDI 60 = C3 (middle C), so offset is -2
        int octave = (midiNote / 12) - 2;
        int noteIndex = midiNote % 12;
        return noteNames[noteIndex] + octave;
    }

    private JsonObject noteStepToJson(NoteStep step) {
        JsonObject obj = new JsonObject();
        obj.addProperty("x", step.x() * extension.getStepSize());  // Convert step index to beat position
        obj.addProperty("y", step.y());
        obj.addProperty("channel", step.channel());
        obj.addProperty("state", step.state().name());
        obj.addProperty("velocity", step.velocity());
        obj.addProperty("duration", step.duration());
        obj.addProperty("gain", step.gain());
        obj.addProperty("pan", step.pan());
        obj.addProperty("pressure", step.pressure());
        obj.addProperty("timbre", step.timbre());
        obj.addProperty("transpose", step.transpose());
        obj.addProperty("releaseVelocity", step.releaseVelocity());
        obj.addProperty("chance", step.chance());
        obj.addProperty("isMuted", step.isMuted());
        obj.addProperty("isChanceEnabled", step.isChanceEnabled());
        obj.addProperty("noteName", midiNoteToName(step.y()));
        return obj;
    }

    public JsonElement handle(String action, JsonObject params) {
        switch (action) {
            case "list":
                return listClips(params);
            case "create":
                return createClip(params);
            case "delete":
                return deleteClip(params);
            case "stop":
                return stopClip(params);
            case "setName":
                return setClipName(params);

            // MIDI Note operations - require selecting a clip first
            case "select":
                return selectClip(params);
            case "getSelection":
                return getSelection(params);
            case "getNotes":
                return getNotes(params);
            case "setNote":
                return setNote(params);
            case "clearNote":
                return clearNote(params);
            case "clearAllNotes":
                return clearAllNotes(params);
            case "clearNotesAtPitch":
                return clearNotesAtPitch(params);
            case "transpose":
                return transposeClip(params);
            case "setLength":
                return setClipLength(params);

            // NoteStep property modifications
            case "setNoteVelocity":
                return setNoteProperty(params, "velocity");
            case "setNoteDuration":
                return setNoteProperty(params, "duration");
            case "setNoteGain":
                return setNoteProperty(params, "gain");
            case "setNotePan":
                return setNoteProperty(params, "pan");
            case "setNotePressure":
                return setNoteProperty(params, "pressure");
            case "setNoteTimbre":
                return setNoteProperty(params, "timbre");
            case "setNoteTranspose":
                return setNoteProperty(params, "transpose");
            case "setNoteChance":
                return setNoteProperty(params, "chance");
            case "setNoteMuted":
                return setNoteMuted(params);
            case "moveNote":
                return moveNote(params);

            // Safe clip creation helpers
            case "hasContent":
                return hasContent(params);
            case "findEmptySlots":
                return findEmptySlots(params);
            case "getSceneCount":
                return getSceneCount(params);
            case "createScene":
                return createScene(params);

            default:
                throw new IllegalArgumentException("Unknown clip action: " + action);
        }
    }

    private JsonElement listClips(JsonObject params) {
        int trackIndex = params.get("trackIndex").getAsInt();
        Track track = extension.getTrackBank().getItemAt(trackIndex);

        if (!track.exists().get()) {
            throw new IllegalArgumentException("Track does not exist at index: " + trackIndex);
        }

        ClipLauncherSlotBank slotBank = track.clipLauncherSlotBank();
        JsonArray clips = new JsonArray();

        for (int i = 0; i < slotBank.getSizeOfBank(); i++) {
            ClipLauncherSlot slot = slotBank.getItemAt(i);
            if (slot.hasContent().get()) {
                JsonObject clipObj = new JsonObject();
                clipObj.addProperty("slotIndex", i);
                clipObj.addProperty("name", slot.name().get());
                clipObj.addProperty("isPlaying", slot.isPlaying().get());
                clipObj.addProperty("isRecording", slot.isRecording().get());
                clipObj.addProperty("isQueued", slot.isPlaybackQueued().get());

                JsonObject color = new JsonObject();
                color.addProperty("red", slot.color().red());
                color.addProperty("green", slot.color().green());
                color.addProperty("blue", slot.color().blue());
                clipObj.add("color", color);

                clips.add(clipObj);
            }
        }

        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", trackIndex);
        result.add("clips", clips);
        result.addProperty("count", clips.size());
        return result;
    }

    private JsonElement createClip(JsonObject params) {
        int trackIndex = params.get("trackIndex").getAsInt();
        int slotIndex = params.get("slotIndex").getAsInt();
        int lengthInBeats = params.has("lengthInBeats") ? params.get("lengthInBeats").getAsInt() : 4;

        Track track = extension.getTrackBank().getItemAt(trackIndex);
        if (!track.exists().get()) {
            throw new IllegalArgumentException("Track does not exist at index: " + trackIndex);
        }

        track.createNewLauncherClip(slotIndex, lengthInBeats);
        return successResponse();
    }

    private JsonElement deleteClip(JsonObject params) {
        int trackIndex = params.get("trackIndex").getAsInt();
        int slotIndex = params.get("slotIndex").getAsInt();

        Track track = extension.getTrackBank().getItemAt(trackIndex);
        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);
        slot.deleteObject();
        return successResponse();
    }

    private JsonElement stopClip(JsonObject params) {
        int trackIndex = params.get("trackIndex").getAsInt();

        Track track = extension.getTrackBank().getItemAt(trackIndex);
        track.stop();
        return successResponse();
    }

    private JsonElement setClipName(JsonObject params) {
        String name = params.get("name").getAsString();
        getClip().setName(name);
        return successResponse();
    }

    /**
     * Select a clip for MIDI editing via MCP command.
     * The cursor clip follows this selection automatically.
     */
    private JsonElement selectClip(JsonObject params) {
        int trackIndex = params.get("trackIndex").getAsInt();
        int slotIndex = params.get("slotIndex").getAsInt();

        // Select the track first
        Track track = extension.getTrackBank().getItemAt(trackIndex);
        track.selectInMixer();

        // Select the clip slot - cursor clip follows automatically
        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);
        slot.select();

        return successResponse();
    }

    /**
     * Get the currently selected clip slot indices from cached observer values.
     * Returns {trackIndex, slotIndex, hasContent, trackName, clipName}
     * or {trackIndex: -1, slotIndex: -1} if no slot is selected.
     */
    private JsonElement getSelection(JsonObject params) {
        int trackIndex = extension.getSelectedTrackIndex();
        int slotIndex = extension.getSelectedSlotIndex();
        String trackName = extension.getCursorTrack().name().get();

        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", trackIndex);
        result.addProperty("slotIndex", slotIndex);

        if (trackIndex >= 0 && slotIndex >= 0) {
            ClipLauncherSlotBank slotBank = extension.getCursorTrack().clipLauncherSlotBank();
            ClipLauncherSlot slot = slotBank.getItemAt(slotIndex);
            result.addProperty("hasContent", slot.hasContent().get());
            result.addProperty("clipName", slot.name().get());
        } else {
            result.addProperty("hasContent", false);
            result.addProperty("clipName", "");
        }

        result.addProperty("trackName", trackName);
        return result;
    }

    /**
     * Get all notes in the currently selected clip.
     * Uses direct getStep queries for reliable synchronous access.
     * The cursor clip follows user's selection in Bitwig UI.
     */
    private JsonElement getNotes(JsonObject params) {
        // Check if the selected slot has content using cached observer values
        int trackIndex = extension.getSelectedTrackIndex();
        int slotIndex = extension.getSelectedSlotIndex();

        boolean hasSelectedClip = false;
        if (trackIndex >= 0 && slotIndex >= 0) {
            ClipLauncherSlotBank slotBank = extension.getCursorTrack().clipLauncherSlotBank();
            ClipLauncherSlot slot = slotBank.getItemAt(slotIndex);
            hasSelectedClip = slot.hasContent().get();
        }

        if (!hasSelectedClip) {
            JsonObject result = new JsonObject();
            result.add("notes", new JsonArray());
            result.addProperty("count", 0);
            result.addProperty("empty", true);
            return result;
        }

        Clip clip = getClip();
        JsonArray notes = new JsonArray();

        // Get clip length in beats and calculate total steps
        double clipLengthBeats = clip.getLoopLength().get();
        int totalSteps = (int) (clipLengthBeats / extension.getStepSize());

        // Cap to cursor clip size (from config)
        totalSteps = Math.min(totalSteps, extension.getClipSteps());

        // Iterate through all step positions and keys, query directly
        for (int x = 0; x < totalSteps; x++) {
            for (int y = 0; y < extension.getClipKeys(); y++) {
                NoteStep step = clip.getStep(0, x, y);
                if (step.state() == NoteStep.State.NoteOn) {
                    notes.add(noteStepToJson(step));
                }
            }
        }

        JsonObject result = new JsonObject();
        result.add("notes", notes);
        result.addProperty("count", notes.size());
        result.addProperty("clipLength", clipLengthBeats);
        return result;
    }

    /**
     * Set (add or modify) a note in the selected clip.
     *
     * @param params: x (beat position), y (key/pitch 0-127), velocity (0-127), duration (in beats)
     */
    private JsonElement setNote(JsonObject params) {
        double xBeats = params.get("x").getAsDouble();  // Beat position
        int x = (int) Math.round(xBeats / extension.getStepSize());   // Convert to step index
        int y = params.get("y").getAsInt();             // MIDI note number (0-127)
        int velocity = params.has("velocity") ? params.get("velocity").getAsInt() : 100;
        double duration = params.has("duration") ? params.get("duration").getAsDouble() : 0.25;
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;

        getClip().setStep(channel, x, y, velocity, duration);
        return successResponse();
    }

    /**
     * Clear (remove) a note from the selected clip.
     */
    private JsonElement clearNote(JsonObject params) {
        double xBeats = params.get("x").getAsDouble();  // Beat position
        int x = (int) Math.round(xBeats / extension.getStepSize());   // Convert to step index
        int y = params.get("y").getAsInt();
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;

        getClip().clearStep(channel, x, y);
        return successResponse();
    }

    /**
     * Clear all notes in the selected clip.
     */
    private JsonElement clearAllNotes(JsonObject params) {
        getClip().clearSteps();
        return successResponse();
    }

    /**
     * Clear all notes at a specific pitch (MIDI note number) in the selected clip.
     * Used for smart pattern replacement - only clears notes at pitches being re-patterned.
     */
    private JsonElement clearNotesAtPitch(JsonObject params) {
        int pitch = params.get("pitch").getAsInt();
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;

        Clip clip = getClip();

        // Get clip length and calculate total steps
        double clipLengthBeats = clip.getLoopLength().get();
        int totalSteps = (int) (clipLengthBeats / extension.getStepSize());
        totalSteps = Math.min(totalSteps, extension.getClipSteps());

        // Iterate through all steps and clear notes at the specified pitch
        for (int x = 0; x < totalSteps; x++) {
            NoteStep step = clip.getStep(channel, x, pitch);
            if (step.state() == NoteStep.State.NoteOn) {
                clip.clearStep(channel, x, pitch);
            }
        }

        return successResponse();
    }

    /**
     * Transpose all notes in the selected clip.
     */
    private JsonElement transposeClip(JsonObject params) {
        int semitones = params.get("semitones").getAsInt();
        getClip().transpose(semitones);
        return successResponse();
    }

    /**
     * Set the clip length.
     */
    private JsonElement setClipLength(JsonObject params) {
        double lengthInBeats = params.get("lengthInBeats").getAsDouble();
        getClip().getLoopLength().set(lengthInBeats);
        return successResponse();
    }

    /**
     * Set a property on a specific note step.
     * Supported properties: velocity, duration, gain, pan, pressure, timbre, transpose, chance
     */
    private JsonElement setNoteProperty(JsonObject params, String property) {
        int x = params.get("x").getAsInt();
        int y = params.get("y").getAsInt();
        double value = params.get("value").getAsDouble();
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;

        NoteStep step = getClip().getStep(channel, x, y);

        switch (property) {
            case "velocity":
                step.setVelocity(value);
                break;
            case "duration":
                step.setDuration(value);
                break;
            case "gain":
                step.setGain(value);
                break;
            case "pan":
                step.setPan(value);
                break;
            case "pressure":
                step.setPressure(value);
                break;
            case "timbre":
                step.setTimbre(value);
                break;
            case "transpose":
                step.setTranspose(value);
                break;
            case "chance":
                step.setChance(value);
                step.setIsChanceEnabled(true);
                break;
            default:
                throw new IllegalArgumentException("Unknown note property: " + property);
        }
        return successResponse();
    }

    /**
     * Mute or unmute a specific note.
     */
    private JsonElement setNoteMuted(JsonObject params) {
        int x = params.get("x").getAsInt();
        int y = params.get("y").getAsInt();
        boolean muted = params.get("muted").getAsBoolean();
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;

        NoteStep step = getClip().getStep(channel, x, y);
        step.setIsMuted(muted);
        return successResponse();
    }

    /**
     * Move a note to a different position.
     */
    private JsonElement moveNote(JsonObject params) {
        int x = params.get("x").getAsInt();
        int y = params.get("y").getAsInt();
        int dx = params.has("dx") ? params.get("dx").getAsInt() : 0;
        int dy = params.has("dy") ? params.get("dy").getAsInt() : 0;
        int channel = params.has("channel") ? params.get("channel").getAsInt() : 0;

        getClip().moveStep(channel, x, y, dx, dy);
        return successResponse();
    }

    // ============ Safe Clip Creation Helpers ============

    /**
     * Check if a specific slot has content.
     * Used for validating target slots before clip creation.
     */
    private JsonElement hasContent(JsonObject params) {
        int trackIndex = params.get("trackIndex").getAsInt();
        int slotIndex = params.get("slotIndex").getAsInt();

        Track track = extension.getTrackBank().getItemAt(trackIndex);
        if (!track.exists().get()) {
            throw new IllegalArgumentException("Track does not exist at index: " + trackIndex);
        }

        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);

        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", trackIndex);
        result.addProperty("slotIndex", slotIndex);
        result.addProperty("hasContent", slot.hasContent().get());
        return result;
    }

    /**
     * Find N empty slots starting from startSlot, going right.
     * Returns array of empty slot indices within project scene bounds.
     */
    private JsonElement findEmptySlots(JsonObject params) {
        int trackIndex = params.get("trackIndex").getAsInt();
        int startSlot = params.get("startSlot").getAsInt();
        int count = params.has("count") ? params.get("count").getAsInt() : 1;

        Track track = extension.getTrackBank().getItemAt(trackIndex);
        if (!track.exists().get()) {
            throw new IllegalArgumentException("Track does not exist at index: " + trackIndex);
        }

        ClipLauncherSlotBank slotBank = track.clipLauncherSlotBank();

        // Get actual scene count from project (not bank window size)
        int sceneCount = extension.getSceneCount();

        JsonArray emptySlots = new JsonArray();
        for (int i = startSlot; i < sceneCount && emptySlots.size() < count; i++) {
            if (!slotBank.getItemAt(i).hasContent().get()) {
                emptySlots.add(i);
            }
        }

        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", trackIndex);
        result.add("emptySlots", emptySlots);
        result.addProperty("found", emptySlots.size());
        result.addProperty("requested", count);
        result.addProperty("sceneCount", sceneCount);
        return result;
    }

    /**
     * Get the actual scene count in the project.
     * This is the true limit for clip creation, not the bank window size.
     */
    private JsonElement getSceneCount(JsonObject params) {
        JsonObject result = new JsonObject();
        result.addProperty("sceneCount", extension.getSceneCount());
        return result;
    }

    /**
     * Create new scene(s) at the end of the project.
     * Used to expand the project when more clip slots are needed.
     *
     * Note: The returned sceneCount may be stale because Bitwig's observer
     * callbacks run on the same thread as this handler. The MCP server
     * adds a delay after this call to allow the observer to fire before
     * retrying findEmptySlots.
     */
    private JsonElement createScene(JsonObject params) {
        int count = params.has("count") ? params.get("count").getAsInt() : 1;

        // Bitwig API: Project.createScene() creates a new scene at the end
        for (int i = 0; i < count; i++) {
            extension.getProject().createScene();
        }

        // Note: We don't poll here - observer callbacks can't fire while
        // we're blocking this thread. The MCP server handles the delay.

        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        result.addProperty("created", count);
        result.addProperty("sceneCount", extension.getSceneCount());
        return result;
    }
}
