'use client';

import { useState } from 'react';

export type NoteTab = 'internal' | 'live';

export interface PostedNote {
  tab: NoteTab;
  text: string;
}

export function useTicketNotes() {
  const [internalNotes, setInternalNotes] = useState<string[]>([]);
  const [liveNotes, setLiveNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [activeNoteTab, setActiveNoteTab] = useState<NoteTab>('internal');

  async function postActiveNote(onPosted?: (note: PostedNote) => Promise<void> | void): Promise<PostedNote | null> {
    const text = noteDraft.trim();
    if (!text) return null;

    const posted = { tab: activeNoteTab, text };
    if (activeNoteTab === 'internal') {
      setInternalNotes(previous => [...previous, text]);
    } else {
      setLiveNotes(previous => [...previous, text]);
    }

    setNoteDraft('');
    await onPosted?.(posted);
    return posted;
  }

  return {
    activeNoteTab,
    internalNotes,
    liveNotes,
    noteDraft,
    postActiveNote,
    setActiveNoteTab,
    setNoteDraft,
  };
}
