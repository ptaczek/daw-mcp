package com.pxaudio.bitwigmcp.server;

import java.io.*;
import java.net.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.*;

import com.pxaudio.bitwigmcp.BitwigMCPExtension;
import com.pxaudio.bitwigmcp.handlers.*;

/**
 * Simple TCP server that accepts JSON-RPC commands and dispatches them
 * to appropriate handlers.
 */
public class MCPServer {
    private final int port;
    private final BitwigMCPExtension extension;
    private final ControllerHost host;
    private final Gson gson;
    private final CommandDispatcher dispatcher;

    private ServerSocket serverSocket;
    private ExecutorService executor;
    private AtomicBoolean running = new AtomicBoolean(false);

    public MCPServer(int port, BitwigMCPExtension extension, ControllerHost host) {
        this.port = port;
        this.extension = extension;
        this.host = host;
        this.gson = new Gson();
        this.dispatcher = new CommandDispatcher(extension, host);
    }

    public void start() throws IOException {
        serverSocket = new ServerSocket(port);
        executor = Executors.newCachedThreadPool();
        running.set(true);

        // Accept connections in a background thread
        executor.submit(() -> {
            while (running.get()) {
                try {
                    Socket clientSocket = serverSocket.accept();
                    host.println("MCP client connected: " + clientSocket.getRemoteSocketAddress());
                    executor.submit(() -> handleClient(clientSocket));
                } catch (IOException e) {
                    if (running.get()) {
                        host.errorln("Error accepting connection: " + e.getMessage());
                    }
                }
            }
        });
    }

    public void stop() {
        running.set(false);
        try {
            if (serverSocket != null) {
                serverSocket.close();
            }
        } catch (IOException e) {
            host.errorln("Error closing server socket: " + e.getMessage());
        }
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    private void handleClient(Socket clientSocket) {
        try (
            BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
            PrintWriter out = new PrintWriter(clientSocket.getOutputStream(), true)
        ) {
            String line;
            StringBuilder messageBuilder = new StringBuilder();

            while ((line = in.readLine()) != null) {
                // Protocol: each message is a single line of JSON
                // Or we can accumulate until we have valid JSON
                messageBuilder.append(line);

                try {
                    JsonObject request = gson.fromJson(messageBuilder.toString(), JsonObject.class);
                    messageBuilder = new StringBuilder();  // Reset for next message

                    // Process request on Bitwig's thread
                    final JsonObject req = request;
                    host.scheduleTask(() -> {
                        JsonObject response = processRequest(req);
                        out.println(gson.toJson(response));
                    }, 0);

                } catch (JsonSyntaxException e) {
                    // Not yet complete JSON, continue reading
                    // Or it's malformed - in production we'd want better handling
                }
            }
        } catch (IOException e) {
            host.println("Client disconnected: " + e.getMessage());
        }
    }

    private JsonObject processRequest(JsonObject request) {
        JsonObject response = new JsonObject();
        response.addProperty("jsonrpc", "2.0");

        // Get request ID
        if (request.has("id")) {
            response.add("id", request.get("id"));
        }

        // Validate JSON-RPC structure
        if (!request.has("method")) {
            return createError(response, -32600, "Invalid Request: missing method");
        }

        String method = request.get("method").getAsString();
        JsonObject params = request.has("params") ? request.getAsJsonObject("params") : new JsonObject();

        try {
            JsonElement result = dispatcher.dispatch(method, params);
            response.add("result", result);
        } catch (IllegalArgumentException e) {
            String message = e.getMessage();
            // Check if this is a method-not-found error vs parameter validation
            // Method-not-found patterns: "Unknown * action:", "Unknown category:", "Invalid method format:"
            if (message != null && (message.contains(" action:") || message.contains("category:") || message.startsWith("Invalid method"))) {
                return createError(response, -32601, "Method not found: " + method);
            } else {
                // Parameter validation error
                return createError(response, -32602, "Invalid params: " + message);
            }
        } catch (Exception e) {
            host.errorln("Error executing " + method + ": " + e.getMessage());
            return createError(response, -32603, "Internal error: " + e.getMessage());
        }

        return response;
    }

    private JsonObject createError(JsonObject response, int code, String message) {
        JsonObject error = new JsonObject();
        error.addProperty("code", code);
        error.addProperty("message", message);
        response.add("error", error);
        return response;
    }
}
