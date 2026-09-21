import { useCallback, useState, useEffect } from "react";
import api from "../lib/api";

export interface Friend {
  id: string;
  username: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  isFriend: boolean;
  isPending?: boolean;
}

export interface FriendRequest {
  requestId: string;
  id: string;
  username: string;
}

// ───────────────────────────────────────────────────────────────────

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);

  const refresh = useCallback(() => {
    api
      .get<Friend[]>("/friends")
      .then((r) => setFriends(r.data))
      .catch(() => {});
    api
      .get<FriendRequest[]>("/friends/requests")
      .then((r) => setRequests(r.data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const addFriend = useCallback(
    async (userId: string) => {
      await api.post("/friends/requests", { toUserId: userId });
      refresh();
    },
    [refresh],
  );

  const acceptRequest = useCallback(
    async (requestId: string) => {
      await api.post(`/friends/requests/${requestId}/accept`);
      refresh();
    },
    [refresh],
  );

  const denyRequest = async (requestId: string) => {
    await api.post(`/friends/requests/${requestId}/deny`);
    refresh();
  };

  const removeFriend = useCallback(
    async (userId: string) => {
      setFriends((prev) => prev.filter((f) => f.id !== userId));
      await api.delete(`/friends/${userId}`).catch(refresh);
    },
    [refresh],
  );

  const searchUsers = useCallback(
    async (query: string): Promise<UserSearchResult[]> => {
      const q = query.trim();
      if (!q) return [];
      try {
        const { data } = await api.get<UserSearchResult[]>(
          `/users/search?q=${encodeURIComponent(q)}`,
        );
        return data;
      } catch {
        return [];
      }
    },
    [],
  );

  return {
    friends,
    addFriend,
    removeFriend,
    refresh,
    searchUsers,
    requests,
    acceptRequest,
    denyRequest,
  };
}
