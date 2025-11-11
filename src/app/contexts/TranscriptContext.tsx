"use client";

import React, {
  createContext,
  useContext,
  useState,
  FC,
  PropsWithChildren,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { TranscriptItem } from "@/app/types";

type TranscriptContextValue = {
  transcriptItems: TranscriptItem[];
  addTranscriptMessage: (
    itemId: string,
    role: "user" | "assistant",
    text: string,
    isHidden?: boolean,
  ) => void;
  updateTranscriptMessage: (itemId: string, text: string, isDelta: boolean) => void;
  addTranscriptBreadcrumb: (title: string, data?: Record<string, any>) => void;
  addTaskProgressMessage: (sessionId: string, taskDescription: string) => void;
  updateTaskProgress: (sessionId: string, progress: number, message: string, details?: any) => void;
  toggleTranscriptItemExpand: (itemId: string) => void;
  updateTranscriptItem: (itemId: string, updatedProperties: Partial<TranscriptItem>) => void;
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
};

const TranscriptContext = createContext<TranscriptContextValue | undefined>(undefined);

export const TranscriptProvider: FC<PropsWithChildren> = ({ children }) => {
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  function newTimestampPretty(): string {
    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    return `${time}.${ms}`;
  }

  const addTranscriptMessage: TranscriptContextValue["addTranscriptMessage"] = (itemId, role, text = "", isHidden = false) => {
    setTranscriptItems((prev) => {
      if (prev.some((log) => log.itemId === itemId && log.type === "MESSAGE")) {
        console.warn(`[addTranscriptMessage] skipping; message already exists for itemId=${itemId}, role=${role}, text=${text}`);
        return prev;
      }

      const newItem: TranscriptItem = {
        itemId,
        type: "MESSAGE",
        role,
        title: text,
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "IN_PROGRESS",
        isHidden,
      };

      return [...prev, newItem];
    });
  };

  const updateTranscriptMessage: TranscriptContextValue["updateTranscriptMessage"] = (itemId, newText, append = false) => {
    setTranscriptItems((prev) => {
      const result = prev.map((item) => {
        if (item.itemId === itemId && item.type === "MESSAGE") {
          const oldTitle = item.title ?? "";
          const newTitle = append ? oldTitle + newText : newText;

          console.log("[updateTranscriptMessage]", {
            itemId,
            append,
            oldTitle,
            oldTitleLength: oldTitle.length,
            deltaText: newText,
            deltaLength: newText.length,
            newTitle,
            newTitleLength: newTitle.length,
          });

          return {
            ...item,
            title: newTitle,
          };
        }
        return item;
      });
      return result;
    });
  };

  const addTranscriptBreadcrumb: TranscriptContextValue["addTranscriptBreadcrumb"] = (title, data) => {
    setTranscriptItems((prev) => [
      ...prev,
      {
        itemId: `breadcrumb-${uuidv4()}`,
        type: "BREADCRUMB",
        title,
        data,
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "DONE",
        isHidden: false,
      },
    ]);

    // Auto-detect sessionId from Intelligent Supervisor breadcrumbs
    if (title.includes('Intelligent Supervisor') && data?.sessionId) {
      console.log('[TranscriptContext] Auto-detected sessionId:', data.sessionId);
      setActiveSessionId(data.sessionId);
    }
  };

  const toggleTranscriptItemExpand: TranscriptContextValue["toggleTranscriptItemExpand"] = (itemId) => {
    setTranscriptItems((prev) =>
      prev.map((log) =>
        log.itemId === itemId ? { ...log, expanded: !log.expanded } : log
      )
    );
  };

  const updateTranscriptItem: TranscriptContextValue["updateTranscriptItem"] = (itemId, updatedProperties) => {
    setTranscriptItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, ...updatedProperties } : item
      )
    );
  };

  const addTaskProgressMessage: TranscriptContextValue["addTaskProgressMessage"] = (sessionId, taskDescription) => {
    console.log('[TranscriptContext] Creating TASK_PROGRESS message for session:', sessionId);

    setTranscriptItems((prev) => [
      ...prev,
      {
        itemId: `task-progress-${sessionId}`,
        type: "TASK_PROGRESS",
        role: "assistant",
        title: taskDescription,
        sessionId,
        progress: 0,
        progressMessage: "Инициализация задачи...",
        progressUpdates: [],
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "IN_PROGRESS",
        isHidden: false,
      },
    ]);
  };

  const updateTaskProgress: TranscriptContextValue["updateTaskProgress"] = (sessionId, progress, message, details) => {
    console.log('[TranscriptContext] Updating task progress:', { sessionId, progress, message });

    setTranscriptItems((prev) =>
      prev.map((item) => {
        if (item.type === "TASK_PROGRESS" && item.sessionId === sessionId) {
          // Prevent updates to already completed tasks
          if (item.status === "DONE" && progress >= 100) {
            console.log('[TranscriptContext] Skipping update - task already marked as DONE');
            return item;
          }

          const newUpdates = [...(item.progressUpdates || []), { progress, message, details, timestamp: Date.now() }];
          return {
            ...item,
            progress,
            progressMessage: message,
            progressUpdates: newUpdates,
            status: progress >= 100 ? "DONE" : "IN_PROGRESS",
          };
        }
        return item;
      })
    );
  };

  return (
    <TranscriptContext.Provider
      value={{
        transcriptItems,
        addTranscriptMessage,
        updateTranscriptMessage,
        addTranscriptBreadcrumb,
        addTaskProgressMessage,
        updateTaskProgress,
        toggleTranscriptItemExpand,
        updateTranscriptItem,
        activeSessionId,
        setActiveSessionId,
      }}
    >
      {children}
    </TranscriptContext.Provider>
  );
};

export function useTranscript() {
  const context = useContext(TranscriptContext);
  if (!context) {
    throw new Error("useTranscript must be used within a TranscriptProvider");
  }
  return context;
}