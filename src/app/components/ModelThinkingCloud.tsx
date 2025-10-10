"use client";

import React from "react";
import ReactMarkdown from "react-markdown";

export interface ModelThinkingCloudProps {
  /** The thinking/processing state message */
  message?: string;
  /** Whether to show animated dots */
  isAnimating?: boolean;
  /** Timestamp to display */
  timestamp?: string;
}

/**
 * ModelThinkingCloud displays a bubble showing the AI model's
 * current processing state or thinking process, styled consistently
 * with the assistant message bubbles.
 */
function ModelThinkingCloud({
  message = "Thinking",
  isAnimating = true,
  timestamp,
}: ModelThinkingCloudProps) {
  return (
    <div className="max-w-lg">
      <div className="max-w-lg p-3 bg-gray-100 text-black rounded-xl">
        {timestamp && (
          <div className="text-xs text-gray-500 font-mono">
            {timestamp}
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Sparkle/thinking icon */}
          {isAnimating && (
            <div className="flex-shrink-0">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="animate-pulse"
              >
                <path
                  d="M12 2L13.09 8.26L19 6L14.74 10.91L21 12L14.74 13.09L19 18L13.09 15.74L12 22L10.91 15.74L5 18L9.26 13.09L3 12L9.26 10.91L5 6L10.91 8.26L12 2Z"
                  fill="currentColor"
                  className="text-gray-400"
                />
              </svg>
            </div>
          )}

          {/* Message text */}
          <div className="whitespace-pre-wrap flex-1">
            {message === "Processing" ? (
              <div className="italic text-gray-600">
                Processing
                <span className="inline-flex ml-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                </span>
              </div>
            ) : (
              <div className="flex items-start flex-1">
                <div className="flex-1">
                  <ReactMarkdown>{message}</ReactMarkdown>
                </div>
                {isAnimating && (
                  <span className="inline-block w-[2px] h-4 ml-1 bg-gray-600 animate-pulse"></span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModelThinkingCloud;
