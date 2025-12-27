# Transport Handler for Ableton MCP
# Handles playback control: position

from __future__ import absolute_import, print_function
import logging

from .base import BaseHandler

logger = logging.getLogger("ableton_mcp")


class TransportHandler(BaseHandler):
    """
    Handles transport/playback operations.

    Methods:
        - setPosition: Set playback position in beats
    """

    def handle_setPosition(self, params):
        """Set playback position in beats."""
        beats = params.get('beats')
        if beats is None:
            raise ValueError("Missing required parameter: beats")

        self.song.current_song_time = float(beats)
        logger.info("Set position to %s beats", beats)
        return self.success()
