import { useState } from "react";
import { useDarkMode } from "../../contexts/DarkMode";
import type { Friend } from "../../hooks/useFriends";
import { useMessages, type Message } from "../../hooks/useMessages";

interface ChatBoxTitleProps {
  name: string;
  big: boolean;
  setBig: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenChat: React.Dispatch<React.SetStateAction<boolean>>;
}

interface MessageBubbleProps {
  message: Message;
  isDarkMode: boolean;
  friend: Friend;
}

interface ChatBoxProps {
  setOpenChat: React.Dispatch<React.SetStateAction<boolean>>;
  friend: Friend | null;
}

function ChatBoxTitle({ name, big, setBig, setOpenChat }: ChatBoxTitleProps) {
  return (
    <>
      <div className="flex flex-row m-[3.2px] p-1 justify-between">
        <p className="font-body tracking-wide">{name}</p>
        <div className="flex flex-row space-x-1">
          <button
            className="border border-(--color-border) rounded aspect-square w-6 text-xs"
            onClick={() => setBig(!big)}
          >
            {big ? "⬇" : "⬆"}
          </button>
          <button
            className="border border-(--color-border) rounded aspect-square w-6 text-xs"
            onClick={() => setOpenChat(false)}
          >
            ⛌
          </button>
        </div>
      </div>
    </>
  );
}

interface ChatMessageInput {
  friendId: string;
  onSend: (toUserId: string, body: string) => void;
}

function ChatMessageInput({ friendId, onSend }: ChatMessageInput) {
  const [newMessage, changeNewMessage] = useState("");

  return (
    <>
      <input
        className="outline-none m-[7.2px] pl-1 pr-1 tracking-wide"
        placeholder="Type to send message"
        type="text"
        value={newMessage}
        onChange={(val) => changeNewMessage(val.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && newMessage.trim()) {
            onSend(friendId, newMessage);
            changeNewMessage("");
          }
        }}
      />
    </>
  );
}

// Split a message body into plain-text and URL segments so links render as
// clickable anchors (e.g. lobby invites) instead of inert text.
const renderBody = (body: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const isUrl = /^https?:\/\/[^\s]+$/;
  return body.split(urlRegex).map((part, i) =>
    isUrl.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline break-all"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
};

const MessageBubble = ({ message, isDarkMode, friend }: MessageBubbleProps) => {
  const isFriendId = message.senderId === friend.id;

  const youColor = isDarkMode ? "bg-green-700" : "bg-green-300";
  const friendColor = isDarkMode ? "bg-blue-700" : "bg-blue-300";

  const getLocalTime = (iso: string) => {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 5);
  };

  return (
    <div
      className={`m-2 w-[60%] ${isFriendId ? "self-end items-end" : "self-start items-start"}`}
    >
      <div className="text-xs flex flex-row justify-between">
        <p>{isFriendId ? friend.username : "You"}</p>
        <p>{getLocalTime(message.createdAt)}</p>
      </div>
      <div
        className={`${isFriendId ? friendColor : youColor} break-all p-1 rounded-xl`}
      >
        <p className="pl-1 pr-1 break-normal overflow: break-words">
          {renderBody(message.body)}
        </p>
      </div>
    </div>
  );
};

export function ChatBox({ setOpenChat, friend }: ChatBoxProps) {
  const { isDarkMode } = useDarkMode();
  const [big, setBig] = useState(false);
  const { messages, sendMessage, getMessages } = useMessages(friend?.id || "");

  if (friend === null) return null;
  if (!big) {
    return (
      <>
        <div
          className={
            "flex flex-col-reverse fixed bottom-0 left-55 w-80 rounded-tr bg-(--bg) border-t border-r border-(--color-border)"
          }
        >
          <ChatBoxTitle
            name={friend.username}
            big={big}
            setBig={setBig}
            setOpenChat={setOpenChat}
          />
        </div>
      </>
    );
  }

  const handleSend = (toUserId: string, body: string) => {
    sendMessage(toUserId, body);
    getMessages(toUserId);
  };

  return (
    <>
      <div
        className="z-10 flex flex-col-reverse fixed bottom-0 left-55px
      h-100 w-80
      rounded-tr
      bg-(--bg)
      border-t
      border-r
      border-(--color-border)
      "
      >
        <ChatMessageInput friendId={friend.id} onSend={handleSend} />
        <div className="flex flex-col-reverse h-full border-t border-b border-(--color-border) overflow-scroll">
          {[...messages].map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isDarkMode={isDarkMode}
              friend={friend}
            />
          ))}
          <p className="text-xs text-center">only 50 messages are displayed</p>
        </div>
        <ChatBoxTitle
          name={friend.username}
          big={big}
          setBig={setBig}
          setOpenChat={setOpenChat}
        />
      </div>
    </>
  );
}
