# Minimal test Remote Script to verify Wine + Ableton can load Python extensions
#
# To test:
# 1. Copy this folder to: ~/.wine/drive_c/users/<user>/Documents/Ableton/User Library/Remote Scripts/
# 2. Start Ableton Live (via Wine)
# 3. Go to Preferences > Link/Tempo/MIDI > Control Surface
# 4. Select "test_remote_script" from the dropdown
# 5. Check Live's status bar for "Test Remote Script loaded!" message

from __future__ import absolute_import, print_function

try:
    from _Framework.ControlSurface import ControlSurface
except ImportError:
    # Fallback for testing outside Live
    ControlSurface = object


class TestRemoteScript(ControlSurface):
    def __init__(self, c_instance):
        super(TestRemoteScript, self).__init__(c_instance)
        self.show_message("Test Remote Script loaded!")
        self.log_message("Test Remote Script initialized successfully")

        # Log some basic info
        try:
            song = self.song()
            self.log_message(f"Song tempo: {song.tempo}")
            self.log_message(f"Track count: {len(song.tracks)}")
        except Exception as e:
            self.log_message(f"Error accessing song: {e}")

    def disconnect(self):
        self.show_message("Test Remote Script disconnected")
        super(TestRemoteScript, self).disconnect()


def create_instance(c_instance):
    """Entry point called by Ableton Live"""
    return TestRemoteScript(c_instance)
