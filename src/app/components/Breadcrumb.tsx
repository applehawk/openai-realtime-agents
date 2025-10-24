"use client";

import React from "react";

interface BreadcrumbProps {
  itemId: string;
  timestamp: string;
  title: string;
  data?: any;
  expanded?: boolean;
  onToggleExpand: (itemId: string) => void;
}

export function Breadcrumb({
  itemId,
  timestamp,
  title,
  data,
  expanded,
  onToggleExpand,
}: BreadcrumbProps) {
  return (
    <div className="flex flex-col justify-start items-start text-gray-500 text-sm">
      <span className="text-xs font-mono">{timestamp}</span>
      <div
        className={`whitespace-pre-wrap flex items-center font-mono text-sm text-gray-800 ${
          data ? "cursor-pointer" : ""
        }`}
        onClick={() => data && onToggleExpand(itemId)}
      >
        {data && (
          <span
            className={`text-gray-400 mr-1 transform transition-transform duration-200 select-none font-mono ${
              expanded ? "rotate-90" : "rotate-0"
            }`}
          >
            ▶
          </span>
        )}
        {title}
      </div>
      {expanded && data && (
        <div className="text-gray-800 text-left">
          <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default Breadcrumb;
