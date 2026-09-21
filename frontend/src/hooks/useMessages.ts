import { useCallback, useEffect, useState } from "react";
import api from "../lib/api";

export interface Message {
  id: string;
  conversationKey: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
}

export function useMessages(friendId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  const getMessages = useCallback(async (id: string) => {
    const r = await api.get(`/messages?with=${id}`);
    setMessages(r.data);
    return r.data;
  }, []);

  const refresh = useCallback(() => {
    if (friendId) getMessages(friendId);
  }, [friendId, getMessages]);

  useEffect(() => {
    if (!friendId) return;
    const interval = setInterval(() => getMessages(friendId), 5000);
    return () => clearInterval(interval);
  }, [friendId, getMessages]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sendMessage = useCallback(
    async (toUserId: string, body: string) => {
      const r = await api.post(`/messages`, { toUserId, body });
      setMessages((prev) => [r.data, ...prev]);
      refresh();
      return r.data;
    },
    [refresh],
  );

  return { messages, sendMessage, getMessages, refresh };
}
