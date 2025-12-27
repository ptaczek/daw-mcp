package com.pxaudio.bitwigmcp.handlers;

import com.bitwig.extension.controller.api.*;
import com.google.gson.*;

import com.pxaudio.bitwigmcp.BitwigMCPExtension;

/**
 * Handles track operations: list, create, delete, modify properties.
 */
public class TrackHandler {
    private final BitwigMCPExtension extension;
    private final ControllerHost host;

    public TrackHandler(BitwigMCPExtension extension, ControllerHost host) {
        this.extension = extension;
        this.host = host;
    }

    private static JsonObject successResponse() {
        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        return result;
    }

    public JsonElement handle(String action, JsonObject params) {
        switch (action) {
            case "list":
                return listTracks();
            case "get":
                return getTrack(params);
            case "create":
                return createTrack(params);
            case "delete":
                return deleteTrack(params);
            case "setName":
                return setTrackName(params);
            case "setVolume":
                return setTrackVolume(params);
            case "setPan":
                return setTrackPan(params);
            case "setMute":
                return setTrackMute(params);
            case "setSolo":
                return setTrackSolo(params);
            case "setArm":
                return setTrackArm(params);
            case "select":
                return selectTrack(params);
            default:
                throw new IllegalArgumentException("Unknown track action: " + action);
        }
    }

    private JsonElement listTracks() {
        TrackBank trackBank = extension.getTrackBank();
        JsonArray tracks = new JsonArray();

        for (int i = 0; i < trackBank.getSizeOfBank(); i++) {
            Track track = trackBank.getItemAt(i);
            if (track.exists().get()) {
                tracks.add(trackToJson(track, i));
            }
        }

        JsonObject result = new JsonObject();
        result.add("tracks", tracks);
        result.addProperty("count", tracks.size());
        return result;
    }

    private JsonElement getTrack(JsonObject params) {
        int index = getTrackIndex(params);
        Track track = extension.getTrackBank().getItemAt(index);

        if (!track.exists().get()) {
            throw new IllegalArgumentException("Track does not exist at index: " + index);
        }

        return trackToJson(track, index);
    }

    private JsonElement createTrack(JsonObject params) {
        String type = params.has("type") ? params.get("type").getAsString() : "instrument";
        int position = params.has("position") ? params.get("position").getAsInt() : -1;

        Application app = extension.getApplication();

        switch (type.toLowerCase()) {
            case "instrument":
                app.createInstrumentTrack(position);
                break;
            case "audio":
                app.createAudioTrack(position);
                break;
            case "effect":
            case "fx":
                app.createEffectTrack(position);
                break;
            default:
                throw new IllegalArgumentException("Unknown track type: " + type);
        }
        return successResponse();
    }

    private JsonElement deleteTrack(JsonObject params) {
        int index = getTrackIndex(params);
        Track track = extension.getTrackBank().getItemAt(index);

        if (!track.exists().get()) {
            throw new IllegalArgumentException("Track does not exist at index: " + index);
        }

        track.deleteObject();
        return successResponse();
    }

    private JsonElement setTrackName(JsonObject params) {
        int index = getTrackIndex(params);
        String name = params.get("name").getAsString();

        Track track = extension.getTrackBank().getItemAt(index);
        track.name().set(name);
        return successResponse();
    }

    private JsonElement setTrackVolume(JsonObject params) {
        int index = getTrackIndex(params);
        double volume = params.get("volume").getAsDouble();

        Track track = extension.getTrackBank().getItemAt(index);
        track.volume().set(Math.max(0, Math.min(1, volume)));
        return successResponse();
    }

    private JsonElement setTrackPan(JsonObject params) {
        int index = getTrackIndex(params);
        double pan = params.get("pan").getAsDouble();

        Track track = extension.getTrackBank().getItemAt(index);
        track.pan().set(Math.max(0, Math.min(1, pan)));  // 0 = left, 0.5 = center, 1 = right
        return successResponse();
    }

    private JsonElement setTrackMute(JsonObject params) {
        int index = getTrackIndex(params);
        boolean mute = params.get("mute").getAsBoolean();

        Track track = extension.getTrackBank().getItemAt(index);
        track.mute().set(mute);
        return successResponse();
    }

    private JsonElement setTrackSolo(JsonObject params) {
        int index = getTrackIndex(params);
        boolean solo = params.get("solo").getAsBoolean();

        Track track = extension.getTrackBank().getItemAt(index);
        track.solo().set(solo);
        return successResponse();
    }

    private JsonElement setTrackArm(JsonObject params) {
        int index = getTrackIndex(params);
        boolean arm = params.get("arm").getAsBoolean();

        Track track = extension.getTrackBank().getItemAt(index);
        track.arm().set(arm);
        return successResponse();
    }

    private JsonElement selectTrack(JsonObject params) {
        int index = getTrackIndex(params);
        Track track = extension.getTrackBank().getItemAt(index);
        track.selectInMixer();
        return successResponse();
    }

    private int getTrackIndex(JsonObject params) {
        if (!params.has("index")) {
            throw new IllegalArgumentException("Missing 'index' parameter");
        }
        return params.get("index").getAsInt();
    }

    private JsonObject trackToJson(Track track, int index) {
        JsonObject obj = new JsonObject();
        obj.addProperty("index", index);
        obj.addProperty("name", track.name().get());
        obj.addProperty("type", track.trackType().get());
        obj.addProperty("volume", track.volume().get());
        obj.addProperty("pan", track.pan().get());
        obj.addProperty("mute", track.mute().get());
        obj.addProperty("solo", track.solo().get());
        obj.addProperty("arm", track.arm().get());

        // Color as RGB
        JsonObject color = new JsonObject();
        color.addProperty("red", track.color().red());
        color.addProperty("green", track.color().green());
        color.addProperty("blue", track.color().blue());
        obj.add("color", color);

        return obj;
    }
}
