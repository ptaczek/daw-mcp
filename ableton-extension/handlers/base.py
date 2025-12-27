# Base Handler for Ableton MCP

from __future__ import absolute_import, print_function
import logging

logger = logging.getLogger("ableton_mcp")


class BaseHandler:
    """
    Base class for all Ableton MCP handlers.

    Provides common functionality for routing actions and
    accessing the Live API through the dispatcher.
    """

    def __init__(self, dispatcher):
        self.dispatcher = dispatcher

    @property
    def song(self):
        """Access the current Live song/set."""
        return self.dispatcher.song

    def handle(self, action, params):
        """
        Route an action to the appropriate handler method.

        Handler methods should be named: handle_{action}
        For example: handle_getInfo, handle_setBpm, handle_play

        Args:
            action: The action name (e.g., "getInfo", "play")
            params: Dict of parameters from the JSON-RPC request

        Returns:
            Dict to be returned as the JSON-RPC result
        """
        method_name = "handle_" + action
        method = getattr(self, method_name, None)

        if not method:
            raise ValueError("Unknown action: " + action)

        return method(params)

    def success(self):
        """Return a simple success response."""
        return {'success': True}
