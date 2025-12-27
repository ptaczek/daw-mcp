# Track Handler for Ableton MCP
# Handles track operations: list, properties

from __future__ import absolute_import, print_function
import logging

from .base import BaseHandler

logger = logging.getLogger("ableton_mcp")


class TrackHandler(BaseHandler):
    """
    Handles track operations.

    Methods:
        - list: List all tracks with properties
        - create: Create a new track
        - delete: Delete a track
        - setName: Set track name
        - setVolume: Set track volume
        - setMute: Set track mute state
        - setSolo: Set track solo state
    """

    def handle_list(self, params):
        """List all tracks with their properties."""
        tracks = []

        for i, track in enumerate(self.song.tracks):
            try:
                track_info = {
                    'index': i,  # 0-based, MCP server converts to 1-based
                    'name': track.name,
                    'mute': track.mute,
                    'solo': track.solo,
                    'arm': track.arm if hasattr(track, 'arm') else False,
                }

                # Mixer device properties (volume, pan)
                if track.mixer_device:
                    mixer = track.mixer_device
                    track_info['volume'] = mixer.volume.value if mixer.volume else 0.85
                    track_info['pan'] = mixer.panning.value if mixer.panning else 0.0

                tracks.append(track_info)
            except Exception as e:
                logger.warning("Error reading track %d: %s", i, e)
                continue

        logger.info("Listed %d tracks", len(tracks))
        return {'tracks': tracks}

    def handle_create(self, params):
        """Create a new track."""
        track_type = params.get('type', 'instrument')  # instrument, audio, effect
        position = params.get('position', -1)  # -1 = end

        try:
            if position == -1:
                position = len(list(self.song.tracks))

            if track_type == 'audio':
                self.song.create_audio_track(position)
            else:
                # 'instrument' and 'effect' both create MIDI tracks
                self.song.create_midi_track(position)

            logger.info("Created %s track at position %d", track_type, position)
            return {'index': position}

        except Exception as e:
            logger.error("Error creating track: %s", e)
            raise

    def handle_delete(self, params):
        """Delete a track by index."""
        index = params.get('index')

        if index is None:
            raise ValueError("index is required")

        try:
            track = self.song.tracks[index]
            self.song.delete_track(index)
            logger.info("Deleted track at index %d", index)

        except Exception as e:
            logger.error("Error deleting track: %s", e)
            raise

        return self.success()

    def handle_setName(self, params):
        """Set track name."""
        index = params.get('index')
        name = params.get('name', '')

        if index is None:
            raise ValueError("index is required")

        try:
            track = self.song.tracks[index]
            track.name = name
            logger.info("Set track %d name to '%s'", index, name)

        except Exception as e:
            logger.error("Error setting track name: %s", e)
            raise

        return self.success()

    def handle_setVolume(self, params):
        """Set track volume (0.0 to 1.0)."""
        index = params.get('index')
        volume = params.get('volume', 0.85)

        if index is None:
            raise ValueError("index is required")

        try:
            track = self.song.tracks[index]
            if track.mixer_device and track.mixer_device.volume:
                track.mixer_device.volume.value = float(volume)
                logger.info("Set track %d volume to %s", index, volume)
            else:
                raise ValueError("Track has no mixer device")

        except Exception as e:
            logger.error("Error setting track volume: %s", e)
            raise

        return self.success()

    def handle_setMute(self, params):
        """Set track mute state."""
        index = params.get('index')
        mute = params.get('mute', False)

        if index is None:
            raise ValueError("index is required")

        try:
            track = self.song.tracks[index]
            track.mute = bool(mute)
            logger.info("Set track %d mute to %s", index, mute)

        except Exception as e:
            logger.error("Error setting track mute: %s", e)
            raise

        return self.success()

    def handle_setSolo(self, params):
        """Set track solo state."""
        index = params.get('index')
        solo = params.get('solo', False)

        if index is None:
            raise ValueError("index is required")

        try:
            track = self.song.tracks[index]
            track.solo = bool(solo)
            logger.info("Set track %d solo to %s", index, solo)

        except Exception as e:
            logger.error("Error setting track solo: %s", e)
            raise

        return self.success()
