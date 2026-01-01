# Clip Handler for Ableton MCP
# Handles clip operations: list, getNotes, setNotes, etc.

from __future__ import absolute_import, print_function
import logging

try:
    import Live
except ImportError:
    Live = None  # For testing outside Live

from .base import BaseHandler

logger = logging.getLogger("ableton_mcp")


class ClipHandler(BaseHandler):
    """
    Handles clip operations.

    Methods:
        - list: List clips in a track
        - create: Create a new clip
        - delete: Delete a clip
        - getNotes: Get MIDI notes from a clip
        - setNote: Add a single MIDI note
        - setNotes: Add multiple MIDI notes (batch)
        - clearAllNotes: Clear all notes from a clip
        - clearNotesAtPitch: Clear notes at a specific MIDI pitch
        - getSelection: Get currently selected clip position
        - select: Select a clip by track/slot index
        - hasContent: Check if a slot has a clip
    """

    def _get_track(self, params):
        """Get track from params or use selected track."""
        track_index = params.get('trackIndex')

        if track_index is not None:
            return self.song.tracks[track_index], track_index
        else:
            # Use selected track
            track = self.song.view.selected_track
            # Find index
            for i, t in enumerate(self.song.tracks):
                if t == track:
                    return track, i
            raise ValueError("Could not find selected track index")

    def _get_clip(self, params):
        """Get clip from params or cursor selection."""
        track_index = params.get('trackIndex')
        slot_index = params.get('slotIndex')

        if track_index is not None and slot_index is not None:
            track = self.song.tracks[track_index]
            slot = track.clip_slots[slot_index]
        else:
            # Use selected clip slot
            track = self.song.view.selected_track
            slot = self.song.view.highlighted_clip_slot

            if slot is None:
                raise ValueError("No clip slot selected")

        if not slot.has_clip:
            raise ValueError("No clip in slot")

        return slot.clip

    def handle_list(self, params):
        """List clips with content in a track."""
        track, track_index = self._get_track(params)
        clips = []

        for i, slot in enumerate(track.clip_slots):
            if slot.has_clip:
                clip = slot.clip
                try:
                    clip_info = {
                        'slotIndex': i,  # 0-based
                        'name': clip.name,
                        'length': clip.length,
                        'isPlaying': clip.is_playing,
                        'isRecording': clip.is_recording,
                    }
                    clips.append(clip_info)
                except Exception as e:
                    logger.warning("Error reading clip at slot %d: %s", i, e)

        logger.info("Listed %d clips on track %d", len(clips), track_index)
        return {'clips': clips}

    def handle_getSelection(self, params):
        """Get currently selected clip position."""
        track = self.song.view.selected_track
        slot = self.song.view.highlighted_clip_slot

        # Find track index
        track_index = None
        for i, t in enumerate(self.song.tracks):
            if t == track:
                track_index = i
                break

        # Find slot index
        slot_index = None
        has_clip = False
        if track and slot:
            for i, s in enumerate(track.clip_slots):
                if s == slot:
                    slot_index = i
                    has_clip = slot.has_clip
                    break

        return {
            'trackIndex': track_index,
            'slotIndex': slot_index,
            'hasClip': has_clip
        }

    def handle_getNotes(self, params):
        """Get MIDI notes from a clip.

        Always returns object format for MCP server compatibility.
        MCP server handles the lean format transformation.
        Velocity is normalized to 0.0-1.0 like Bitwig.
        """
        clip = self._get_clip(params)

        # get_notes(from_time, from_pitch, time_span, pitch_span)
        # Returns tuple of tuples: ((pitch, time, duration, velocity, mute), ...)
        try:
            notes = clip.get_notes(0.0, 0, clip.length, 128)
            logger.info("Got %d notes via get_notes (length=%s)", len(notes) if notes else 0, clip.length)
        except Exception as e:
            logger.error("Error getting notes: %s", e)
            return {'notes': [], 'count': 0}

        if not notes:
            return {'notes': [], 'count': 0, 'clipLength': float(clip.length)}

        # Always return object format - MCP server handles lean transformation
        # Velocity normalized to 0.0-1.0 for consistency with Bitwig
        note_list = []
        for note in notes:
            try:
                # Tuple format: (pitch, time, duration, velocity, mute)
                pitch, time, duration, velocity, mute = note
                note_list.append({
                    'x': float(time),
                    'y': int(pitch),
                    'velocity': float(velocity) / 127.0,  # Normalize to 0.0-1.0
                    'duration': float(duration),
                    'isMuted': bool(mute),
                })
            except Exception as e:
                logger.warning("Error reading note: %s (note=%s)", e, note)

        return {'notes': note_list, 'count': len(note_list), 'clipLength': float(clip.length)}

    def handle_clearAllNotes(self, params):
        """Clear all notes from a clip."""
        clip = self._get_clip(params)

        try:
            # Use extended API to avoid Live 11 warning dialog
            clip.remove_notes_extended(from_pitch=0, pitch_span=128,
                                       from_time=0.0, time_span=clip.length)
            logger.info("Cleared all notes from clip")
        except Exception as e:
            logger.error("Error clearing notes: %s", e)
            raise

        return self.success()

    def handle_clearNotesAtPitch(self, params):
        """Clear all notes at a specific pitch (MIDI note number) from a clip.
        Used for smart pattern replacement - only clears notes at pitches being re-patterned.
        """
        clip = self._get_clip(params)
        pitch = params.get('pitch')

        if pitch is None:
            raise ValueError("pitch parameter is required")

        try:
            # Use extended API with pitch_span=1 to clear only the specified pitch
            clip.remove_notes_extended(from_pitch=pitch, pitch_span=1,
                                       from_time=0.0, time_span=clip.length)
            logger.info("Cleared notes at pitch %d from clip", pitch)
        except Exception as e:
            logger.error("Error clearing notes at pitch %d: %s", pitch, e)
            raise

        return self.success()

    def handle_setNotes(self, params):
        """Set MIDI notes in a clip. Accepts both ultra-lean and object formats."""
        clip = self._get_clip(params)
        notes_data = params.get('notes', [])

        if not notes_data:
            return self.success()

        if Live is None:
            raise ValueError("Live API not available")

        try:
            notes = []
            for note in notes_data:
                if isinstance(note, list):
                    # Ultra-lean format: [x, y, velocity, duration]
                    x, y, velocity, duration = note
                    muted = False
                else:
                    # Object format
                    x = note['x']
                    y = note['y']
                    velocity = note.get('velocity', 100)
                    duration = note.get('duration', 0.25)
                    muted = note.get('muted', False)

                spec = Live.Clip.MidiNoteSpecification(
                    start_time=float(x),
                    duration=float(duration),
                    pitch=int(y),
                    velocity=float(velocity),
                    mute=muted
                )
                notes.append(spec)

            clip.add_new_notes(tuple(notes))
            logger.info("Added %d notes to clip", len(notes))

        except Exception as e:
            logger.error("Error setting notes: %s", e)
            raise

        return self.success()

    def handle_create(self, params):
        """Create a new clip in a slot."""
        track_index = params.get('trackIndex')
        slot_index = params.get('slotIndex')
        length = params.get('lengthInBeats', 4.0)
        name = params.get('name')

        if track_index is not None and slot_index is not None:
            track = self.song.tracks[track_index]
            slot = track.clip_slots[slot_index]
        else:
            # Use selected slot
            track = self.song.view.selected_track
            slot = self.song.view.highlighted_clip_slot
            if slot is None:
                raise ValueError("No clip slot selected")

        if slot.has_clip:
            raise ValueError("Slot already has a clip")

        try:
            slot.create_clip(float(length))
            logger.info("Created clip with length %s beats", length)

            # Set name if provided
            if name and slot.has_clip:
                slot.clip.name = name

        except Exception as e:
            logger.error("Error creating clip: %s", e)
            raise

        return self.success()

    def handle_delete(self, params):
        """Delete a clip from a slot."""
        track_index = params.get('trackIndex')
        slot_index = params.get('slotIndex')

        if track_index is not None and slot_index is not None:
            track = self.song.tracks[track_index]
            slot = track.clip_slots[slot_index]
        else:
            # Use selected slot
            track = self.song.view.selected_track
            slot = self.song.view.highlighted_clip_slot
            if slot is None:
                raise ValueError("No clip slot selected")

        if not slot.has_clip:
            raise ValueError("No clip in slot")

        try:
            slot.delete_clip()
            logger.info("Deleted clip from slot")
        except Exception as e:
            logger.error("Error deleting clip: %s", e)
            raise

        return self.success()

    def handle_transpose(self, params):
        """Transpose all notes in a clip by semitones."""
        clip = self._get_clip(params)
        semitones = params.get('semitones', 0)

        if semitones == 0:
            return self.success()

        if Live is None:
            raise ValueError("Live API not available")

        try:
            # Get all notes using tuple API
            notes = clip.get_notes(0.0, 0, clip.length, 128)

            if not notes:
                return self.success()

            # Clear existing notes using extended API
            clip.remove_notes_extended(from_pitch=0, pitch_span=128,
                                       from_time=0.0, time_span=clip.length)

            # Add transposed notes
            new_notes = []
            for note in notes:
                # Tuple format: (pitch, time, duration, velocity, mute)
                pitch, time, duration, velocity, mute = note
                new_pitch = pitch + semitones
                # Clamp to valid MIDI range
                if 0 <= new_pitch <= 127:
                    spec = Live.Clip.MidiNoteSpecification(
                        start_time=float(time),
                        duration=float(duration),
                        pitch=int(new_pitch),
                        velocity=float(velocity),
                        mute=bool(mute)
                    )
                    new_notes.append(spec)

            if new_notes:
                clip.add_new_notes(tuple(new_notes))
            logger.info("Transposed %d notes by %d semitones", len(new_notes), semitones)

        except Exception as e:
            logger.error("Error transposing clip: %s", e)
            raise

        return self.success()

    def handle_select(self, params):
        """Select a clip by track/slot index."""
        track_index = params.get('trackIndex')
        slot_index = params.get('slotIndex')

        if track_index is None or slot_index is None:
            raise ValueError("trackIndex and slotIndex are required for select")

        try:
            track = self.song.tracks[track_index]
            slot = track.clip_slots[slot_index]

            # Select the track first
            self.song.view.selected_track = track

            # Then highlight the clip slot
            self.song.view.highlighted_clip_slot = slot

            logger.info("Selected clip at track %d, slot %d", track_index, slot_index)

        except Exception as e:
            logger.error("Error selecting clip: %s", e)
            raise

        return self.success()

    def handle_hasContent(self, params):
        """Check if a slot has a clip."""
        track_index = params.get('trackIndex')
        slot_index = params.get('slotIndex')

        if track_index is None or slot_index is None:
            raise ValueError("trackIndex and slotIndex are required")

        try:
            track = self.song.tracks[track_index]
            slot = track.clip_slots[slot_index]
            has_content = slot.has_clip

            return {'hasContent': has_content}

        except Exception as e:
            logger.error("Error checking slot content: %s", e)
            raise

    def handle_setNote(self, params):
        """Add a single MIDI note to a clip."""
        clip = self._get_clip(params)

        if Live is None:
            raise ValueError("Live API not available")

        x = params.get('x', 0)
        y = params.get('y', 60)
        velocity = params.get('velocity', 100)
        duration = params.get('duration', 0.25)
        muted = params.get('muted', False)

        try:
            spec = Live.Clip.MidiNoteSpecification(
                start_time=float(x),
                duration=float(duration),
                pitch=int(y),
                velocity=float(velocity),
                mute=muted
            )
            clip.add_new_notes((spec,))
            logger.info("Added note at x=%s, y=%s", x, y)

        except Exception as e:
            logger.error("Error adding note: %s", e)
            raise

        return self.success()

    def handle_stop(self, params):
        """Stop a clip."""
        track_index = params.get('trackIndex')
        slot_index = params.get('slotIndex')

        if track_index is not None and slot_index is not None:
            track = self.song.tracks[track_index]
            slot = track.clip_slots[slot_index]
        else:
            # Use selected slot
            track = self.song.view.selected_track
            slot = self.song.view.highlighted_clip_slot
            if slot is None:
                raise ValueError("No clip slot selected")

        try:
            slot.stop()
            logger.info("Stopped clip slot")
        except Exception as e:
            logger.error("Error stopping clip: %s", e)
            raise

        return self.success()

    def handle_findEmptySlots(self, params):
        """Find empty clip slots on a track."""
        track_index = params.get('trackIndex')
        count = params.get('count', 1)
        start_from = params.get('startSlot', params.get('startFrom', 0))

        if track_index is None:
            track = self.song.view.selected_track
            # Find track index
            for i, t in enumerate(self.song.tracks):
                if t == track:
                    track_index = i
                    break
        else:
            track = self.song.tracks[track_index]

        # Get scene count (actual project scenes, not max possible)
        scene_count = len(self.song.scenes)

        empty_slots = []
        for i in range(start_from, min(len(track.clip_slots), scene_count)):
            if not track.clip_slots[i].has_clip:
                empty_slots.append(i)
                if len(empty_slots) >= count:
                    break

        logger.info("Found %d empty slots on track %d: %s", len(empty_slots), track_index, empty_slots)
        return {
            'trackIndex': track_index,
            'emptySlots': empty_slots,
            'found': len(empty_slots),
            'requested': count,
            'sceneCount': scene_count
        }

    def handle_setName(self, params):
        """Set the name of a clip."""
        clip = self._get_clip(params)
        name = params.get('name', '')

        try:
            clip.name = name
            logger.info("Set clip name to '%s'", name)
        except Exception as e:
            logger.error("Error setting clip name: %s", e)
            raise

        return self.success()

    def handle_setLength(self, params):
        """Set the length of a clip."""
        clip = self._get_clip(params)
        length = params.get('lengthInBeats', 4.0)

        try:
            # In Live, we need to set loop_end for MIDI clips
            clip.loop_end = float(length)
            logger.info("Set clip length to %s beats", length)
        except Exception as e:
            logger.error("Error setting clip length: %s", e)
            raise

        return self.success()

    def handle_clearNote(self, params):
        """Remove a single note at position x, y."""
        clip = self._get_clip(params)
        x = params.get('x')
        y = params.get('y')

        if x is None or y is None:
            raise ValueError("x and y are required")

        if Live is None:
            raise ValueError("Live API not available")

        try:
            # Get all notes
            notes = clip.get_notes(0.0, 0, clip.length, 128)

            # Filter out the target note (match by position and pitch)
            new_notes = []
            removed = False
            for note in notes:
                pitch, time, duration, velocity, mute = note
                # Check if this is the note to remove (within small tolerance)
                if abs(time - float(x)) < 0.001 and int(pitch) == int(y):
                    removed = True
                    continue
                # Keep this note
                spec = Live.Clip.MidiNoteSpecification(
                    start_time=float(time),
                    duration=float(duration),
                    pitch=int(pitch),
                    velocity=float(velocity),
                    mute=bool(mute)
                )
                new_notes.append(spec)

            if not removed:
                logger.warning("Note not found at x=%s, y=%s", x, y)
                return self.success()

            # Clear and rewrite
            clip.remove_notes_extended(from_pitch=0, pitch_span=128,
                                       from_time=0.0, time_span=clip.length)
            if new_notes:
                clip.add_new_notes(tuple(new_notes))

            logger.info("Cleared note at x=%s, y=%s", x, y)

        except Exception as e:
            logger.error("Error clearing note: %s", e)
            raise

        return self.success()

    def handle_moveNote(self, params):
        """Move a single note by dx, dy."""
        clip = self._get_clip(params)
        x = params.get('x')
        y = params.get('y')
        dx = params.get('dx', 0)
        dy = params.get('dy', 0)

        if x is None or y is None:
            raise ValueError("x and y are required")

        if dx == 0 and dy == 0:
            return self.success()

        if Live is None:
            raise ValueError("Live API not available")

        try:
            # Get all notes
            notes = clip.get_notes(0.0, 0, clip.length, 128)

            # Find and move the target note
            new_notes = []
            moved = False
            for note in notes:
                pitch, time, duration, velocity, mute = note
                new_time = float(time)
                new_pitch = int(pitch)

                # Check if this is the note to move
                if abs(time - float(x)) < 0.001 and int(pitch) == int(y):
                    new_time = float(time) + float(dx)
                    new_pitch = int(pitch) + int(dy)
                    moved = True

                # Clamp pitch to valid range
                if 0 <= new_pitch <= 127 and new_time >= 0:
                    spec = Live.Clip.MidiNoteSpecification(
                        start_time=new_time,
                        duration=float(duration),
                        pitch=new_pitch,
                        velocity=float(velocity),
                        mute=bool(mute)
                    )
                    new_notes.append(spec)

            if not moved:
                logger.warning("Note not found at x=%s, y=%s", x, y)
                return self.success()

            # Clear and rewrite
            clip.remove_notes_extended(from_pitch=0, pitch_span=128,
                                       from_time=0.0, time_span=clip.length)
            if new_notes:
                clip.add_new_notes(tuple(new_notes))

            logger.info("Moved note from x=%s, y=%s by dx=%s, dy=%s", x, y, dx, dy)

        except Exception as e:
            logger.error("Error moving note: %s", e)
            raise

        return self.success()

    def _modify_note_property(self, params, prop_name, prop_key):
        """Helper to modify a single note property."""
        clip = self._get_clip(params)
        x = params.get('x')
        y = params.get('y')
        # MCP server sends 'value', but also support specific key name
        value = params.get(prop_key)
        if value is None:
            value = params.get('value')

        if x is None or y is None:
            raise ValueError("x and y are required")
        if value is None:
            raise ValueError(f"{prop_key} or value is required")

        if Live is None:
            raise ValueError("Live API not available")

        try:
            notes = clip.get_notes(0.0, 0, clip.length, 128)

            new_notes = []
            modified = False
            for note in notes:
                pitch, time, duration, velocity, mute = note
                new_velocity = float(velocity)
                new_duration = float(duration)
                new_mute = bool(mute)

                if abs(time - float(x)) < 0.001 and int(pitch) == int(y):
                    modified = True
                    if prop_name == 'velocity':
                        new_velocity = float(value)
                    elif prop_name == 'duration':
                        new_duration = float(value)
                    elif prop_name == 'muted':
                        new_mute = bool(value)

                spec = Live.Clip.MidiNoteSpecification(
                    start_time=float(time),
                    duration=new_duration,
                    pitch=int(pitch),
                    velocity=new_velocity,
                    mute=new_mute
                )
                new_notes.append(spec)

            if not modified:
                logger.warning("Note not found at x=%s, y=%s", x, y)
                return self.success()

            clip.remove_notes_extended(from_pitch=0, pitch_span=128,
                                       from_time=0.0, time_span=clip.length)
            if new_notes:
                clip.add_new_notes(tuple(new_notes))

            logger.info("Set note %s to %s at x=%s, y=%s", prop_name, value, x, y)

        except Exception as e:
            logger.error("Error setting note %s: %s", prop_name, e)
            raise

        return self.success()

    def handle_setNoteVelocity(self, params):
        """Set velocity of a single note."""
        return self._modify_note_property(params, 'velocity', 'velocity')

    def handle_setNoteDuration(self, params):
        """Set duration of a single note."""
        return self._modify_note_property(params, 'duration', 'duration')

    def handle_setNoteMuted(self, params):
        """Set muted state of a single note."""
        return self._modify_note_property(params, 'muted', 'muted')

    def handle_getSceneCount(self, params):
        """Get the number of scenes in the project."""
        return {'sceneCount': len(self.song.scenes)}

    def handle_createScene(self, params):
        """Create new scene(s) at the end of the project."""
        count = params.get('count', 1)

        try:
            for _ in range(count):
                # Live API: create_scene(index) - at end = len(scenes)
                self.song.create_scene(len(self.song.scenes))

            logger.info("Created %d scene(s), total now: %d", count, len(self.song.scenes))

        except Exception as e:
            logger.error("Error creating scene: %s", e)
            raise

        return {
            'success': True,
            'created': count,
            'sceneCount': len(self.song.scenes)
        }
