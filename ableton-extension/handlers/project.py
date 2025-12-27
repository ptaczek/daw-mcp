# Project Handler for Ableton MCP
# Handles project-level operations: info

from __future__ import absolute_import, print_function
import logging

from .base import BaseHandler

logger = logging.getLogger("ableton_mcp")


class ProjectHandler(BaseHandler):
    """
    Handles project-level operations.

    Methods:
        - getInfo: Get BPM, time signature, playback state
    """

    def handle_getInfo(self, params):
        """Get current project information."""
        song = self.song
        return {
            'bpm': song.tempo,
            'timeSignatureNumerator': song.signature_numerator,
            'timeSignatureDenominator': song.signature_denominator,
            'isPlaying': song.is_playing,
            'isRecording': song.record_mode,
        }
