import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  useFriends,
  type Friend,
  type UserSearchResult,
} from "../../hooks/useFriends";

function FriendMenu({
  x,
  y,
  onViewProfile,
  onMessage,
  onRemove,
  onClose,
}: {
  x: number;
  y: number;
  onViewProfile: () => void;
  onMessage?: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = "w-full text-left px-3 py-2 transition-colors";

  return createPortal(
    <div
      ref={menuRef}
      style={{ top: y, left: x }}
      className="fixed z-[120] min-w-[150px] rounded-md border border-[var(--border)] bg-[var(--bg)] shadow-xl py-1
				[font-family:var(--font-condensed)] text-[11px] tracking-[0.12em] uppercase"
    >
      <button
        onClick={onViewProfile}
        className={`${item} text-[var(--text)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]`}
      >
        View profile
      </button>
      {onMessage && (
        <button
          onClick={onMessage}
          className={`${item} text-[var(--text)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]`}
        >
          Message
        </button>
      )}
      <button
        onClick={onRemove}
        className={`${item} text-[var(--muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]`}
      >
        Remove friend
      </button>
    </div>,
    document.body,
  );
}

interface FriendsPanelProps {
  messageFriend?: (friend: Friend) => void;
}

export function FriendsPanel({ messageFriend }: FriendsPanelProps) {
  const navigate = useNavigate();
  const {
    friends,
    requests,
    addFriend,
    acceptRequest,
    denyRequest,
    removeFriend,
    searchUsers,
  } = useFriends();

  const [adding, setAdding] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    friend: Friend;
  } | null>(null);

  // one request 250ms after typing stops
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void searchUsers(q).then(setResults);
    }, 250);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  // flip the row to "pending" so the + doesn't linger
  const handleAdd = async (userId: string) => {
    await addFriend(userId);
    setResults((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isPending: true } : u)),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between px-6 mt-2 mb-1">
        <span className="[font-family:var(--font-condensed)] text-[13px] tracking-[0.12em] uppercase text-[var(--muted)]">
          Friends
        </span>
        <div
          className="flex items-center gap-2"
          style={{ marginBottom: "4px" }}
        >
          {/* Pending requests */}
          <button
            onClick={() => setShowRequests((v) => !v)}
            title="Friend requests"
            className="relative text-[var(--muted)] text-[14px] leading-none hover:text-[var(--accent)] transition-colors"
          >
            ✉
            {requests.length > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--accent)] text-white text-[9px] leading-[14px] text-center">
                {requests.length}
              </span>
            )}
          </button>
          {/* Add friend */}
          <button
            onClick={() => setAdding((a) => !a)}
            title="Add friend"
            className="text-[var(--accent)] text-[16px] leading-none hover:opacity-70 transition-opacity"
          >
            {adding ? "×" : "+"}
          </button>
        </div>
      </div>

      {/* Pending requests list */}
      {showRequests && (
        <div className="shrink-0 px-6 pb-2">
          {requests.length === 0 ? (
            <p className="[font-family:var(--font-body)] text-[11px] text-[var(--muted)] py-1">
              No pending requests.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto">
              {requests.map((req) => (
                <div
                  key={req.requestId}
                  className="flex items-center justify-between gap-2 px-1 py-1"
                >
                  <span className="[font-family:var(--font-body)] text-[11px] text-[var(--text)] truncate">
                    {req.username}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => acceptRequest(req.requestId)}
                      title="Accept"
                      className="text-[var(--success)] text-[13px] leading-none hover:opacity-70"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => denyRequest(req.requestId)}
                      title="Decline"
                      className="text-[var(--danger)] text-[13px] leading-none hover:opacity-70"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add-friend search */}
      {adding && (
        <div className="shrink-0 px-6 pb-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username…"
            className="w-full bg-transparent border border-[var(--border)] rounded px-2 py-1.5 text-[11px] [font-family:var(--font-body)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          {results.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5 max-h-[160px] overflow-y-auto">
              {results.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2 px-1 py-1"
                >
                  <span className="[font-family:var(--font-body)] text-[11px] text-[var(--text)] truncate">
                    {u.username}
                  </span>
                  {u.isFriend ? (
                    <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">
                      added
                    </span>
                  ) : u.isPending ? (
                    <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">
                      pending
                    </span>
                  ) : (
                    <button
                      onClick={() => void handleAdd(u.id)}
                      className="text-[var(--accent)] text-[14px] leading-none hover:opacity-70"
                    >
                      +
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-1 shrink-0 border-t border-[var(--border)]" />

      {/* The friend list is the scroll box: grows to fill, scrolls when full */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {friends.length === 0 && !adding && (
          <p className="px-6 py-2 [font-family:var(--font-body)] text-[11px] text-[var(--muted)]">
            No friends yet...
            <br /> Hit + to add some!
          </p>
        )}
        {friends.map((friend) => (
          <button
            key={friend.id}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, friend });
            }}
            onDoubleClick={() => messageFriend?.(friend)}
            className="flex shrink-0 items-center gap-3 px-10 py-2 text-left hover:bg-[var(--accent)]/5 transition-colors"
          >
            <span className="[font-family:var(--font-body)] text-[11px] text-[var(--text)] truncate">
              {friend.username}
            </span>
          </button>
        ))}
      </div>

      {menu && (
        <FriendMenu
          x={menu.x}
          y={menu.y}
          onViewProfile={() => {
            navigate(`/u/${menu.friend.username}`);
            setMenu(null);
          }}
          onMessage={
            messageFriend
              ? () => {
                  messageFriend(menu.friend);
                  setMenu(null);
                }
              : undefined
          }
          onRemove={() => {
            removeFriend(menu.friend.id);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
