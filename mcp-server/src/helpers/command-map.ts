/**
 * Maps MCP tool names to DAW protocol commands.
 * Same mapping for both DAWs (unified protocol).
 */

const commandMapping: Record<string, string> = {
  'get_project_info': 'project.getInfo',
  'transport_set_position': 'transport.setPosition',
  'list_tracks': 'track.list',
  'create_track': 'track.create',
  'delete_track': 'track.delete',
  'set_track_name': 'track.setName',
  'set_track_volume': 'track.setVolume',
  'set_track_mute': 'track.setMute',
  'set_track_solo': 'track.setSolo',
  'create_clip': 'clip.create',
  'delete_clip': 'clip.delete',
  'select_clip': 'clip.select',
  'set_note': 'clip.setNote',
  'clear_note': 'clip.clearNote',
  'transpose_clip': 'clip.transpose',
  'set_clip_length': 'clip.setLength',
  'set_note_velocity': 'clip.setNoteVelocity',
  'set_note_duration': 'clip.setNoteDuration',
  'set_note_gain': 'clip.setNoteGain',
  'set_note_pan': 'clip.setNotePan',
  'set_note_pressure': 'clip.setNotePressure',
  'set_note_timbre': 'clip.setNoteTimbre',
  'set_note_transpose': 'clip.setNoteTranspose',
  'set_note_chance': 'clip.setNoteChance',
  'set_note_muted': 'clip.setNoteMuted',
  'move_note': 'clip.moveNote'
};

export function getCommand(toolName: string): string {
  return commandMapping[toolName] || toolName;
}
