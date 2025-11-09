"use client";

import React, { useEffect, useRef, useState } from "react";
import { TranscriptItem } from "@/app/types";
import Image from "next/image";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { DownloadIcon, ClipboardCopyIcon } from "@radix-ui/react-icons";
import { Message } from "./Message";
import { Breadcrumb } from "./Breadcrumb";
import { TaskProgressMessage } from "./TaskProgressMessage";
import { HITLApprovalWidget } from "./HITLApprovalWidget";

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  downloadRecording: () => void;
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  downloadRecording,
}: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand, updateHITLApproval } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const [justCopied, setJustCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      scrollToBottom();
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  // Autofocus on text box input on load
  useEffect(() => {
    if (canSend && inputRef.current) {
      inputRef.current.focus();
    }
  }, [canSend]);

  const handleCopyTranscript = async () => {
    if (!transcriptRef.current) return;
    try {
      await navigator.clipboard.writeText(transcriptRef.current.innerText);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  const handleHITLApprove = async (itemId: string, modifiedContent?: string, feedback?: string) => {
    try {
      const item = transcriptItems.find(t => t.itemId === itemId);
      if (!item || !item.sessionId) return;

      const decision = modifiedContent ? "modified" : "approved";

      // Update UI immediately
      updateHITLApproval(itemId, "APPROVED", decision, modifiedContent, feedback);

      // Send approval to backend
      await fetch("/api/supervisor/unified/hitl/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: item.sessionId,
          itemId,
          decision,
          modifiedContent,
          feedback,
        }),
      });
    } catch (error) {
      console.error("Failed to approve HITL:", error);
    }
  };

  const handleHITLReject = async (itemId: string, feedback: string) => {
    try {
      const item = transcriptItems.find(t => t.itemId === itemId);
      if (!item || !item.sessionId) return;

      // Update UI immediately
      updateHITLApproval(itemId, "REJECTED", "rejected", undefined, feedback);

      // Send rejection to backend
      await fetch("/api/supervisor/unified/hitl/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: item.sessionId,
          itemId,
          feedback,
        }),
      });
    } catch (error) {
      console.error("Failed to reject HITL:", error);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white min-h-0 rounded-xl">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 py-3 sticky top-0 z-10 text-base border-b bg-white rounded-t-xl">
          <span className="font-semibold">Transcript</span>
          <div className="flex gap-x-2">
            <button
              onClick={handleCopyTranscript}
              className="w-24 text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-x-1"
            >
              <ClipboardCopyIcon />
              {justCopied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={downloadRecording}
              className="w-40 text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-x-1"
            >
              <DownloadIcon />
              <span>Download Audio</span>
            </button>
          </div>
        </div>

        {/* Transcript Content */}
        <div
          ref={transcriptRef}
          className="overflow-auto p-4 flex flex-col gap-y-4 h-full"
        >
          {[...transcriptItems]
            .sort((a, b) => a.createdAtMs - b.createdAtMs)
            .map((item) => {
              const {
                itemId,
                type,
                role,
                data,
                expanded,
                timestamp,
                title = "",
                isHidden,
                guardrailResult,
              } = item;

            if (isHidden) {
              return null;
            }

            if (type === "MESSAGE" && (role === "user" || role === "assistant")) {
              return (
                <Message
                  key={itemId}
                  itemId={itemId}
                  role={role}
                  title={title}
                  timestamp={timestamp}
                  status={item.status}
                  guardrailResult={guardrailResult}
                />
              );
            } else if (type === "BREADCRUMB") {
              return (
                <Breadcrumb
                  key={itemId}
                  itemId={itemId}
                  timestamp={timestamp}
                  title={title}
                  data={data}
                  expanded={expanded}
                  onToggleExpand={toggleTranscriptItemExpand}
                />
              );
            } else if (type === "TASK_PROGRESS") {
              // Render task progress message
              return (
                <div key={itemId} className="flex justify-start flex-col items-start">
                  <TaskProgressMessage
                    sessionId={item.sessionId || ''}
                    taskDescription={title}
                    timestamp={timestamp}
                    initialProgress={item.progress || 0}
                    initialMessage={item.progressMessage || 'Инициализация задачи...'}
                  />
                </div>
              );
            } else if (type === "HITL_APPROVAL" && item.hitlData) {
              // Render HITL approval widget
              return (
                <HITLApprovalWidget
                  key={itemId}
                  itemId={itemId}
                  sessionId={item.sessionId || ''}
                  timestamp={timestamp}
                  hitlData={item.hitlData}
                  status={item.status as "WAITING_APPROVAL" | "APPROVED" | "REJECTED"}
                  onApprove={handleHITLApprove}
                  onReject={handleHITLReject}
                />
              );
            } else {
              // Fallback if type is unknown
              return (
                <div
                  key={itemId}
                  className="flex justify-center text-gray-500 text-sm italic font-mono"
                >
                  Unknown item type: {type}{" "}
                  <span className="ml-2 text-xs">{timestamp}</span>
                </div>
              );
            }
          })}
        </div>
      </div>

      <div className="p-4 flex items-center gap-x-2 flex-shrink-0 border-t border-gray-200">
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) {
              onSendMessage();
            }
          }}
          className="flex-1 px-4 py-2 focus:outline-none"
          placeholder="Type a message..."
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="bg-gray-900 text-white rounded-full px-2 py-2 disabled:opacity-50"
        >
          <Image src="arrow.svg" alt="Send" width={24} height={24} />
        </button>
      </div>
    </div>
  );
}

export default Transcript;
