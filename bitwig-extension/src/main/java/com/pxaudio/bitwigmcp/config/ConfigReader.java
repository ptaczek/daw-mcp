package com.pxaudio.bitwigmcp.config;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.io.File;
import java.io.FileReader;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Reads shared configuration file for DAW MCP.
 * Config file location:
 * - Linux: ~/.config/daw-mcp/config.json
 * - macOS: ~/Library/Application Support/daw-mcp/config.json
 * - Windows: %APPDATA%\daw-mcp\config.json
 */
public class ConfigReader {
    private static final Gson gson = new Gson();

    // Defaults
    private int port = 8181;
    private int tracks = 128;
    private int sends = 8;
    private int scenes = 128;
    private int gridResolution = 16;          // 1/16th notes
    private int cursorClipLengthBeats = 128;  // 32 bars × 4 beats
    private int clipKeys = 128;

    // Calculated values
    private double stepSize;
    private int clipSteps;

    public ConfigReader() {
        // Calculate defaults first
        stepSize = 4.0 / gridResolution;
        clipSteps = (int) (cursorClipLengthBeats * (gridResolution / 4.0));
        // Then try to load from file
        load();
    }

    private void load() {
        File configFile = getConfigFile();
        if (!configFile.exists()) {
            System.out.println("[BitwigMCP] No config file found at " + configFile.getPath() + ", using defaults");
            return;
        }

        try (FileReader reader = new FileReader(configFile)) {
            JsonObject root = gson.fromJson(reader, JsonObject.class);
            if (root == null) {
                System.err.println("[BitwigMCP] Config file is empty, using defaults");
                return;
            }

            // Read global gridResolution (applies to both DAWs)
            if (root.has("gridResolution")) gridResolution = root.get("gridResolution").getAsInt();

            // Read from bitwig section
            if (root.has("bitwig")) {
                JsonObject bitwig = root.getAsJsonObject("bitwig");
                if (bitwig.has("port")) port = bitwig.get("port").getAsInt();
                if (bitwig.has("cursorClipLengthBeats")) cursorClipLengthBeats = bitwig.get("cursorClipLengthBeats").getAsInt();
                if (bitwig.has("scenes")) scenes = bitwig.get("scenes").getAsInt();
            }

            // Calculate derived values
            stepSize = 4.0 / gridResolution;
            clipSteps = (int) (cursorClipLengthBeats * (gridResolution / 4.0));

            System.out.println("[BitwigMCP] Config loaded: port=" + port +
                ", gridResolution=" + gridResolution + ", stepSize=" + stepSize +
                ", cursorClipLengthBeats=" + cursorClipLengthBeats + ", clipSteps=" + clipSteps +
                ", scenes=" + scenes);

        } catch (Exception e) {
            System.err.println("[BitwigMCP] Failed to read config: " + e.getMessage() + ", using defaults");
        }
    }

    private File getConfigFile() {
        String os = System.getProperty("os.name").toLowerCase();
        Path configPath;

        if (os.contains("win")) {
            String appData = System.getenv("APPDATA");
            if (appData == null) {
                appData = System.getProperty("user.home");
            }
            configPath = Paths.get(appData, "daw-mcp", "config.json");
        } else if (os.contains("mac")) {
            configPath = Paths.get(System.getProperty("user.home"),
                "Library", "Application Support", "daw-mcp", "config.json");
        } else {
            // Linux and others
            configPath = Paths.get(System.getProperty("user.home"),
                ".config", "daw-mcp", "config.json");
        }

        return configPath.toFile();
    }

    // Getters
    public int getPort() { return port; }
    public int getTracks() { return tracks; }
    public int getSends() { return sends; }
    public int getScenes() { return scenes; }
    public int getGridResolution() { return gridResolution; }
    public int getCursorClipLengthBeats() { return cursorClipLengthBeats; }
    public double getStepSize() { return stepSize; }
    public int getClipSteps() { return clipSteps; }
    public int getClipKeys() { return clipKeys; }
}
