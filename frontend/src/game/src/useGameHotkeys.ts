import { useEffect } from "react";

interface Params {
  setShowHelp: (fn: (v: boolean) => boolean) => void;
  setShowLeavePrompt: (fn: (v: boolean) => boolean) => void;
  // Whether the leave prompt is currently open (gates the Enter-to-confirm).
  showLeavePrompt: boolean;
  // Confirm action for the leave prompt (context-aware; from App).
  onConfirmLeave: () => void;
  roomCode: string | null;
}

// Window-level game hotkeys + the hash-room reload fix.
//  - H / Esc toggle the help and leave-prompt overlays (Esc again cancels the
//    leave prompt).
//  - Enter confirms the leave prompt while it's open (same as "Yes, leave").
//  - hashchange: switching the #r= room code in the same tab only mutates the
//    hash (PlayroomKit won't re-init), so force a reload to join the new room.
export function useGameHotkeys({
  setShowHelp,
  setShowLeavePrompt,
  showLeavePrompt,
  onConfirmLeave,
  roomCode,
}: Params) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") setShowHelp((v) => !v);
      // Esc toggles the "Leave race?" confirmation (Esc again cancels it).
      if (e.key === "Escape") setShowLeavePrompt((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setShowHelp, setShowLeavePrompt]);

  // While the "Leave race?" prompt is open, Enter confirms it.
  useEffect(() => {
    if (!showLeavePrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirmLeave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showLeavePrompt, onConfirmLeave]);

  // Re-join the new room cleanly when the #r= code actually changes (matches
  // after reload, so this never loops). PlayroomKit writes the hash with an "R"
  // prefix (`r=R<code>`) while getRoomCode() — the source of `roomCode` — returns
  // the bare code, so normalize the prefix before comparing; otherwise the codes
  // never match and every hashchange triggers a spurious reload.
  useEffect(() => {
    const onHashChange = () => {
      const m = window.location.hash.match(/r=R?([^&]+)/);
      const codeInUrl = m ? m[1] : null;
      if (codeInUrl && roomCode && codeInUrl !== roomCode) {
        window.location.reload();
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [roomCode]);
}
