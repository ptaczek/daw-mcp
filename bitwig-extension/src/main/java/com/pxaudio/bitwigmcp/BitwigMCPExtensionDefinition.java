package com.pxaudio.bitwigmcp;

import java.util.UUID;

import com.bitwig.extension.api.PlatformType;
import com.bitwig.extension.controller.AutoDetectionMidiPortNamesList;
import com.bitwig.extension.controller.ControllerExtensionDefinition;
import com.bitwig.extension.controller.api.ControllerHost;

public class BitwigMCPExtensionDefinition extends ControllerExtensionDefinition {
    private static final UUID DRIVER_ID = UUID.fromString("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    public BitwigMCPExtensionDefinition() {
    }

    @Override
    public String getName() {
        return "Bitwig MCP Bridge";
    }

    @Override
    public String getAuthor() {
        return "PX-Audio";
    }

    @Override
    public String getVersion() {
        return "1.0.0";
    }

    @Override
    public UUID getId() {
        return DRIVER_ID;
    }

    @Override
    public String getHardwareVendor() {
        return "PX-Audio";
    }

    @Override
    public String getHardwareModel() {
        return "MCP Bridge";
    }

    @Override
    public int getRequiredAPIVersion() {
        return 18;
    }

    @Override
    public int getNumMidiInPorts() {
        return 0;  // No MIDI ports needed - we use TCP
    }

    @Override
    public int getNumMidiOutPorts() {
        return 0;
    }

    @Override
    public void listAutoDetectionMidiPortNames(
            final AutoDetectionMidiPortNamesList list,
            final PlatformType platformType) {
        // No auto-detection needed - this is a virtual controller
    }

    @Override
    public BitwigMCPExtension createInstance(final ControllerHost host) {
        return new BitwigMCPExtension(this, host);
    }
}
