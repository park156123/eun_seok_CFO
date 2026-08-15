export function resolveSpecialNotes(
  localRec?: { specialNotes?: string; noteConfirmedAt?: string } | null,
  remoteRec?: { specialNotes?: string; noteConfirmedAt?: string } | null
): { specialNotes: string; noteConfirmedAt: string } {
  const localNotes = (localRec?.specialNotes || '').trim();
  const remoteNotes = (remoteRec?.specialNotes || '').trim();
  const localAt = localRec?.noteConfirmedAt || '';
  const remoteAt = remoteRec?.noteConfirmedAt || '';

  // Rule A: Local exists, Remote empty
  if (localNotes && !remoteNotes) {
    return {
      specialNotes: localRec?.specialNotes || '',
      noteConfirmedAt: localAt,
    };
  }

  // Rule B: Local empty, Remote exists
  if (!localNotes && remoteNotes) {
    return {
      specialNotes: remoteRec?.specialNotes || '',
      noteConfirmedAt: remoteAt,
    };
  }

  // Both empty
  if (!localNotes && !remoteNotes) {
    return {
      specialNotes: '',
      noteConfirmedAt: '',
    };
  }

  // Rule C & D: Both exist -> compare noteConfirmedAt
  if (localAt && remoteAt) {
    if (localAt >= remoteAt) {
      return {
        specialNotes: localRec?.specialNotes || '',
        noteConfirmedAt: localAt,
      };
    } else {
      return {
        specialNotes: remoteRec?.specialNotes || '',
        noteConfirmedAt: remoteAt,
      };
    }
  }

  if (localAt && !remoteAt) {
    return {
      specialNotes: localRec?.specialNotes || '',
      noteConfirmedAt: localAt,
    };
  }
  if (!localAt && remoteAt) {
    return {
      specialNotes: remoteRec?.specialNotes || '',
      noteConfirmedAt: remoteAt,
    };
  }

  // Default fallback: prefer Local
  return {
    specialNotes: localRec?.specialNotes || '',
    noteConfirmedAt: localAt,
  };
}
