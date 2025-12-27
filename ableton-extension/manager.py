# Ableton MCP Manager
# ControlSurface subclass with tick scheduler for non-blocking TCP

from __future__ import absolute_import, print_function
import logging
import sys

# Set up logging before imports
logging.basicConfig(
    level=logging.INFO,
    format='[AbletonMCP] %(levelname)s: %(message)s'
)
logger = logging.getLogger("ableton_mcp")

try:
    from _Framework.ControlSurface import ControlSurface
except ImportError:
    # For testing outside Live
    logger.warning("Running outside Ableton Live environment")
    ControlSurface = object

from .tcp_server import TCPServer
from .dispatcher import CommandDispatcher


class AbletonMCP(ControlSurface):
    """
    Ableton Live MCP Bridge.

    Exposes a JSON-RPC 2.0 API over TCP for controlling Live from
    external tools like Claude Code via MCP.

    Uses cooperative scheduling (schedule_message) to poll the TCP
    server since Live's Python doesn't support threading.
    """

    def __init__(self, c_instance):
        super(AbletonMCP, self).__init__(c_instance)

        self._tcp_server = None
        self._dispatcher = None

        try:
            # Initialize TCP server
            self._tcp_server = TCPServer(port=8182)

            # Initialize command dispatcher
            self._dispatcher = CommandDispatcher(self)
            self._tcp_server.set_handler(self._dispatcher.dispatch)

            # Start the tick scheduler
            self._schedule_tick()

            # Show success message
            self.show_message("Ableton MCP started on port 8182")
            logger.info("Ableton MCP initialized successfully")

        except Exception as e:
            logger.error("Failed to initialize Ableton MCP: %s", e)
            self.show_message("Ableton MCP failed to start: " + str(e))

    def _schedule_tick(self):
        """Schedule the next tick."""
        # schedule_message(delay, callback)
        # delay=1 means next tick (~100ms in Live's scheduler)
        self.schedule_message(1, self._tick)

    def _tick(self):
        """
        Called every ~100ms to process TCP messages.

        This is the cooperative multitasking pattern required by
        Live's Python environment which doesn't support threading.
        """
        try:
            if self._tcp_server:
                self._tcp_server.process()
        except Exception as e:
            logger.error("Tick error: %s", e)

        # Reschedule for next tick
        self._schedule_tick()

    def song(self):
        """Get the current song (Live Set)."""
        return super(AbletonMCP, self).song()

    def disconnect(self):
        """Called when the control surface is disconnected."""
        logger.info("Disconnecting Ableton MCP")

        if self._tcp_server:
            self._tcp_server.shutdown()
            self._tcp_server = None

        self.show_message("Ableton MCP disconnected")
        super(AbletonMCP, self).disconnect()
