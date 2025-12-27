package com.pxaudio.bitwigmcp.handlers;

import com.bitwig.extension.controller.api.*;
import com.google.gson.*;

import com.pxaudio.bitwigmcp.BitwigMCPExtension;

/**
 * Handles transport operations: play, stop, record, position.
 */
public class TransportHandler {
    private final BitwigMCPExtension extension;
    private final ControllerHost host;

    public TransportHandler(BitwigMCPExtension extension, ControllerHost host) {
        this.extension = extension;
        this.host = host;
    }

    public JsonElement handle(String action, JsonObject params) {
        switch (action) {
            case "togglePlay":
                return togglePlay();
            case "toggleRecord":
                return toggleRecord();
            case "setPosition":
                return setPosition(params);
            case "getStatus":
                return getStatus();
            default:
                throw new IllegalArgumentException("Unknown transport action: " + action);
        }
    }

    private static JsonObject successResponse() {
        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        return result;
    }

    private JsonElement togglePlay() {
        Transport transport = extension.getTransport();
        if (transport.isPlaying().get()) {
            transport.stop();
        } else {
            transport.play();
        }
        return successResponse();
    }

    private JsonElement toggleRecord() {
        extension.getTransport().isArrangerRecordEnabled().toggle();
        return successResponse();
    }

    private JsonElement setPosition(JsonObject params) {
        if (!params.has("beats")) {
            throw new IllegalArgumentException("Missing 'beats' parameter");
        }

        double beats = params.get("beats").getAsDouble();
        extension.getTransport().setPosition(beats);
        return successResponse();
    }

    private JsonElement getStatus() {
        Transport transport = extension.getTransport();

        JsonObject result = new JsonObject();
        result.addProperty("isPlaying", transport.isPlaying().get());
        result.addProperty("isRecording", transport.isArrangerRecordEnabled().get());
        result.addProperty("position", transport.getPosition().get());
        return result;
    }
}
