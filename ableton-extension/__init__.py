# Ableton MCP Extension
# Entry point for Live MIDI Remote Script
#
# Exposes a JSON-RPC 2.0 API over TCP (port 8182) for controlling
# Ableton Live from external tools like Claude Code via MCP.

from __future__ import absolute_import, print_function

from .manager import AbletonMCP


def create_instance(c_instance):
    """
    Called by Ableton Live to create the control surface instance.
    This is the entry point for the MIDI Remote Script.
    """
    return AbletonMCP(c_instance)
