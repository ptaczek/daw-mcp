package com.pxaudio.bitwigmcp.handlers;

import com.bitwig.extension.controller.api.*;
import com.google.gson.*;

import com.pxaudio.bitwigmcp.BitwigMCPExtension;

/**
 * Handles project-level operations: BPM, time signature, project info.
 */
public class ProjectHandler {
    private final BitwigMCPExtension extension;
    private final ControllerHost host;

    public ProjectHandler(BitwigMCPExtension extension, ControllerHost host) {
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
            case "getInfo":
                return getProjectInfo();
            default:
                throw new IllegalArgumentException("Unknown project action: " + action);
        }
    }

    private JsonElement getProjectInfo() {
        Transport transport = extension.getTransport();

        JsonObject result = new JsonObject();
        // Bitwig tempo is normalized 0-1, representing 20-666 BPM
        double normalizedTempo = transport.tempo().get();
        double bpm = 20.0 + normalizedTempo * (666.0 - 20.0);
        result.addProperty("bpm", bpm);
        result.addProperty("timeSignature", transport.timeSignature().get());
        result.addProperty("isPlaying", transport.isPlaying().get());
        result.addProperty("isRecording", transport.isArrangerRecordEnabled().get());
        result.addProperty("playbackPosition", transport.getPosition().get());

        return result;
    }
}
