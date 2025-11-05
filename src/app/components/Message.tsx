"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { GuardrailChip } from "./GuardrailChip";
import ModelThinkingCloud from "./ModelThinkingCloud";
import { GuardrailResultType } from "@/app/types";

interface MessageProps {
  itemId: string;
  role: "user" | "assistant";
  title: string;
  timestamp: string;
  status?: string;
  guardrailResult?: GuardrailResultType;
}

export function Message({
  itemId,
  role,
  title,
  timestamp,
  status,
  guardrailResult,
}: MessageProps) {
  const isUser = role === "user";
  const containerClasses = `flex justify-end flex-col ${
    isUser ? "items-end" : "items-start"
  }`;
  const bubbleBase = `max-w-lg p-3 ${
    isUser ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-black"
  }`;

  const isBracketedMessage = title.startsWith("[") && title.endsWith("]");
  const messageStyle = isBracketedMessage ? "italic text-gray-400" : "";
  const displayTitle = isBracketedMessage ? title.slice(1, -1) : title;

  const isAssistant = !isUser;
  const isInProgress = status === "IN_PROGRESS";
  const hasText = Boolean(title);

  if (isAssistant && isInProgress) {
    console.log("[Message] Assistant IN_PROGRESS:", {
      itemId,
      hasText,
      title,
      titleLength: title?.length || 0,
      displayTitle,
      displayTitleLength: displayTitle?.length || 0,
      status,
      willShowInCloud: hasText ? displayTitle : "Processing",
    });
  }

  return (
    <div className={containerClasses}>
      {isAssistant && isInProgress ? (
        <ModelThinkingCloud
          message={hasText ? displayTitle : "Processing"}
          isAnimating={true}
          timestamp={timestamp}
        />
      ) : (
        <div className="max-w-lg">
          <div
            className={`${bubbleBase} rounded-t-xl ${
              guardrailResult ? "" : "rounded-b-xl"
            }`}
          >
            <div
              className={`text-xs ${
                isUser ? "text-gray-400" : "text-gray-500"
              } font-mono`}
            >
              {timestamp}
            </div>
            <div className={`whitespace-pre-wrap ${messageStyle}`}>
              <ReactMarkdown>{displayTitle}</ReactMarkdown>
            </div>
          </div>
          {guardrailResult && (
            <div className="bg-gray-200 px-3 py-2 rounded-b-xl">
              <GuardrailChip guardrailResult={guardrailResult} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Message;
