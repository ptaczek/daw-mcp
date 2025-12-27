# Non-blocking TCP server for Ableton MCP
# Adapted from AbletonOSC patterns (MIT licensed)

from __future__ import absolute_import, print_function
import socket
import errno
import json
import logging

logger = logging.getLogger("ableton_mcp")

DEFAULT_PORT = 8182


class TCPServer:
    """
    Non-blocking TCP server for JSON-RPC communication.

    Designed to work within Ableton Live's Python environment which
    doesn't support threading. Uses non-blocking sockets polled via
    the ControlSurface's schedule_message() tick.
    """

    def __init__(self, port=DEFAULT_PORT):
        self._port = port
        self._handler = None
        self._socket = None
        self._clients = []
        self._buffers = {}  # Per-client receive buffers
        self._running = False

        self._init_socket()

    def _init_socket(self):
        """Initialize the server socket."""
        try:
            self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._socket.setblocking(0)
            self._socket.bind(('127.0.0.1', self._port))
            self._socket.listen(5)
            self._running = True
            logger.info("TCP server listening on port %d", self._port)
        except socket.error as e:
            logger.error("Failed to start TCP server: %s", e)
            raise

    def set_handler(self, handler):
        """Set the request handler function.

        Handler signature: handler(request_dict) -> response_dict
        """
        self._handler = handler

    def process(self):
        """
        Process pending connections and messages.

        Called each tick (~100ms) from the ControlSurface.
        Non-blocking - returns immediately if no work to do.
        """
        if not self._running:
            return

        self._accept_connections()
        self._read_messages()

    def _accept_connections(self):
        """Accept any pending connections (non-blocking)."""
        try:
            client_socket, addr = self._socket.accept()
            client_socket.setblocking(0)
            self._clients.append(client_socket)
            self._buffers[client_socket] = ""
            logger.info("Client connected from %s", addr)
        except socket.error as e:
            if e.errno not in (errno.EAGAIN, errno.EWOULDBLOCK):
                logger.error("Accept error: %s", e)

    def _read_messages(self):
        """Read and process messages from all connected clients."""
        for client in self._clients[:]:  # Copy list to allow removal during iteration
            try:
                data = client.recv(65536)
                if not data:
                    # Client disconnected
                    self._remove_client(client)
                    continue

                # Append to buffer
                self._buffers[client] += data.decode('utf-8')

                # Process complete messages (newline-delimited)
                self._process_buffer(client)

            except socket.error as e:
                if e.errno in (errno.EAGAIN, errno.EWOULDBLOCK):
                    # No data available - normal for non-blocking
                    continue
                elif e.errno == errno.ECONNRESET:
                    logger.info("Client connection reset")
                    self._remove_client(client)
                else:
                    logger.error("Read error: %s", e)
                    self._remove_client(client)

    def _process_buffer(self, client):
        """Process complete JSON-RPC messages from client buffer."""
        buffer = self._buffers[client]

        while '\n' in buffer:
            line, buffer = buffer.split('\n', 1)
            self._buffers[client] = buffer

            if not line.strip():
                continue

            try:
                request = json.loads(line)
                response = self._handle_request(request)
                self._send_response(client, response)
            except json.JSONDecodeError as e:
                logger.error("JSON parse error: %s", e)
                error_response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {
                        "code": -32700,
                        "message": "Parse error: " + str(e)
                    }
                }
                self._send_response(client, error_response)

    def _handle_request(self, request):
        """Handle a JSON-RPC request and return response."""
        request_id = request.get('id')

        if not self._handler:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": "No handler configured"
                }
            }

        try:
            return self._handler(request)
        except Exception as e:
            logger.error("Handler error: %s", e)
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }

    def _send_response(self, client, response):
        """Send JSON-RPC response to client."""
        try:
            data = json.dumps(response) + '\n'
            client.sendall(data.encode('utf-8'))
        except socket.error as e:
            logger.error("Send error: %s", e)
            self._remove_client(client)

    def _remove_client(self, client):
        """Clean up a disconnected client."""
        if client in self._clients:
            self._clients.remove(client)
        if client in self._buffers:
            del self._buffers[client]
        try:
            client.close()
        except:
            pass
        logger.info("Client disconnected")

    def shutdown(self):
        """Shut down the server and all client connections."""
        self._running = False

        for client in self._clients[:]:
            self._remove_client(client)

        if self._socket:
            try:
                self._socket.close()
            except:
                pass
            self._socket = None

        logger.info("TCP server shut down")
