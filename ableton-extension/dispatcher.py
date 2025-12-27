# Command Dispatcher for Ableton MCP
# Routes JSON-RPC methods to appropriate handlers

from __future__ import absolute_import, print_function
import logging

logger = logging.getLogger("ableton_mcp")

# Import handlers
from .handlers.project import ProjectHandler
from .handlers.transport import TransportHandler
from .handlers.track import TrackHandler
from .handlers.clip import ClipHandler


class CommandDispatcher:
    """
    Routes JSON-RPC requests to appropriate handlers.

    Method format: "category.action"
    Examples: "project.getInfo", "transport.play", "clip.getNotes"
    """

    def __init__(self, manager):
        self.manager = manager
        self._song = None

        # Initialize handlers
        self.handlers = {
            'project': ProjectHandler(self),
            'transport': TransportHandler(self),
            'track': TrackHandler(self),
            'clip': ClipHandler(self),
        }

    @property
    def song(self):
        """Lazy access to song to ensure it's available."""
        if self._song is None:
            self._song = self.manager.song()
        return self._song

    def dispatch(self, request):
        """
        Handle a JSON-RPC request and return response.

        Args:
            request: Dict with jsonrpc, id, method, params

        Returns:
            Dict with jsonrpc, id, result or error
        """
        request_id = request.get('id')
        method = request.get('method', '')
        params = request.get('params', {})

        logger.info("Dispatching: %s", method)

        try:
            # Special case: ping for connectivity testing
            if method == 'ping':
                return self._success(request_id, {'pong': True})

            # Parse method as category.action
            parts = method.split('.', 1)
            if len(parts) != 2:
                return self._error(request_id, -32601, "Invalid method format: " + method)

            category, action = parts

            # Find handler
            handler = self.handlers.get(category)
            if not handler:
                return self._error(request_id, -32601, "Unknown category: " + category)

            # Execute handler
            result = handler.handle(action, params)
            return self._success(request_id, result)

        except ValueError as e:
            # Known error (e.g., unknown action)
            logger.warning("Handler error: %s", e)
            return self._error(request_id, -32602, str(e))
        except Exception as e:
            # Unexpected error
            logger.error("Dispatch error: %s", e, exc_info=True)
            return self._error(request_id, -32603, str(e))

    def _success(self, request_id, result):
        """Create a success response."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result
        }

    def _error(self, request_id, code, message):
        """Create an error response."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": code,
                "message": message
            }
        }
