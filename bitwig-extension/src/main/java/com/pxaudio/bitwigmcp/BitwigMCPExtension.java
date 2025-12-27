package com.pxaudio.bitwigmcp;

import com.bitwig.extension.controller.ControllerExtension;
import com.bitwig.extension.controller.api.*;

import com.pxaudio.bitwigmcp.config.ConfigReader;
import com.pxaudio.bitwigmcp.server.MCPServer;
import com.pxaudio.bitwigmcp.handlers.*;

public class BitwigMCPExtension extends ControllerExtension {
    private ConfigReader config;
    private MCPServer server;
    private Transport transport;
    private Application application;
    private Arranger arranger;
    private TrackBank trackBank;
    private SceneBank sceneBank;
    private CursorTrack cursorTrack;
    private Clip cursorClip;

    // Cached cursor position (updated via observers)
    private int selectedTrackIndex = -1;
    private int selectedSlotIndex = -1;

    protected BitwigMCPExtension(
            final BitwigMCPExtensionDefinition definition,
            final ControllerHost host) {
        super(definition, host);
    }

    @Override
    public void init() {
        final ControllerHost host = getHost();

        // Load configuration first
        config = new ConfigReader();

        // Initialize Bitwig API objects
        transport = host.createTransport();
        application = host.createApplication();
        arranger = host.createArranger();

        // Create track bank with configurable sizes
        // Using createTrackBank with hasFlatTrackList=true to access tracks nested inside groups
        trackBank = host.createTrackBank(config.getTracks(), config.getSends(), config.getScenes(), true);

        // Get SceneBank for scene count detection
        // itemCount() returns actual project scene count, not bank window size
        sceneBank = trackBank.sceneBank();
        sceneBank.itemCount().markInterested();

        cursorTrack = host.createCursorTrack("MCP_CURSOR", "MCP Cursor Track", config.getSends(), config.getScenes(), true);

        // Mark cursor track position to get track index
        cursorTrack.position().markInterested();
        cursorTrack.name().markInterested();

        // Note: We don't use cursorTrack for slot selection because clicking a clip
        // doesn't auto-select its track in Bitwig. Instead, we observe ALL tracks below.

        // Create cursor clip for MIDI note editing with configurable dimensions
        // Created from cursorTrack so it follows user's clip selection in Bitwig UI
        cursorClip = cursorTrack.createLauncherCursorClip(config.getClipSteps(), config.getClipKeys());
        cursorClip.setStepSize(config.getStepSize());  // Configurable grid resolution
        cursorClip.getLoopLength().markInterested();
        cursorClip.exists().markInterested();

        // Mark cursorTrack's clip launcher slots to detect selection and content
        ClipLauncherSlotBank cursorSlotBank = cursorTrack.clipLauncherSlotBank();
        for (int j = 0; j < cursorSlotBank.getSizeOfBank(); j++) {
            ClipLauncherSlot slot = cursorSlotBank.getItemAt(j);
            slot.isSelected().markInterested();
            slot.hasContent().markInterested();
            slot.name().markInterested();
        }

        // Note: cursorSlotBank observer removed - we use trackBank observers instead
        // because clicking a clip doesn't auto-select its track in Bitwig.

        // Mark values as interested so we can read them
        transport.tempo().markInterested();
        transport.getPosition().markInterested();
        transport.isPlaying().markInterested();
        transport.isArrangerRecordEnabled().markInterested();
        transport.timeSignature().markInterested();

        // Mark track bank values as interested
        for (int i = 0; i < trackBank.getSizeOfBank(); i++) {
            Track track = trackBank.getItemAt(i);
            track.exists().markInterested();
            track.name().markInterested();
            track.position().markInterested();
            track.volume().markInterested();
            track.pan().markInterested();
            track.mute().markInterested();
            track.solo().markInterested();
            track.arm().markInterested();
            track.trackType().markInterested();
            track.color().markInterested();

            // Mark clip launcher slots
            ClipLauncherSlotBank slotBank = track.clipLauncherSlotBank();
            for (int j = 0; j < slotBank.getSizeOfBank(); j++) {
                ClipLauncherSlot slot = slotBank.getItemAt(j);
                slot.exists().markInterested();
                slot.hasContent().markInterested();
                slot.name().markInterested();
                slot.color().markInterested();
                slot.isPlaying().markInterested();
                slot.isRecording().markInterested();
                slot.isPlaybackQueued().markInterested();
            }

            // Observer for slot selection on this track
            // This catches clip selection on ANY track, not just cursorTrack
            final int trackIdx = i;
            slotBank.addIsSelectedObserver((slotIdx, selected) -> {
                if (selected) {
                    selectedTrackIndex = trackIdx;
                    selectedSlotIndex = slotIdx;
                    host.println("[MCP] Slot SELECTED: track=" + trackIdx + " slot=" + slotIdx);
                } else {
                    host.println("[MCP] Slot DESELECTED: track=" + trackIdx + " slot=" + slotIdx);
                }
            });
        }

        // Initialize and start the server
        try {
            server = new MCPServer(config.getPort(), this, host);
            server.start();
            host.showPopupNotification("Bitwig MCP Bridge started on port " + config.getPort());
        } catch (Exception e) {
            host.errorln("Failed to start MCP server: " + e.getMessage());
            host.showPopupNotification("MCP Bridge failed to start: " + e.getMessage());
        }
    }

    @Override
    public void exit() {
        if (server != null) {
            server.stop();
        }
        getHost().showPopupNotification("Bitwig MCP Bridge stopped");
    }

    @Override
    public void flush() {
        // Called regularly - can be used to send updates if needed
    }

    // Getters for handlers to access Bitwig API objects
    public Transport getTransport() {
        return transport;
    }

    public Application getApplication() {
        return application;
    }

    public Arranger getArranger() {
        return arranger;
    }

    public TrackBank getTrackBank() {
        return trackBank;
    }

    public CursorTrack getCursorTrack() {
        return cursorTrack;
    }

    public Clip getCursorClip() {
        return cursorClip;
    }

    public int getSelectedTrackIndex() {
        return selectedTrackIndex;
    }

    public int getSelectedSlotIndex() {
        return selectedSlotIndex;
    }

    public SceneBank getSceneBank() {
        return sceneBank;
    }

    public int getSceneCount() {
        return sceneBank.itemCount().get();
    }

    public int getClipSteps() {
        return config.getClipSteps();
    }

    public int getClipKeys() {
        return config.getClipKeys();
    }

    public double getStepSize() {
        return config.getStepSize();
    }
}
