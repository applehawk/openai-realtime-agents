"use client";

import React, { useState } from "react";
import { HITLApprovalData } from "@/app/types";
import { CheckIcon, Cross2Icon, Pencil1Icon } from "@radix-ui/react-icons";

export interface HITLApprovalWidgetProps {
  itemId: string;
  sessionId: string;
  timestamp: string;
  hitlData: HITLApprovalData;
  status: "WAITING_APPROVAL" | "APPROVED" | "REJECTED";
  onApprove: (itemId: string, modifiedContent?: string, feedback?: string) => void;
  onReject: (itemId: string, feedback: string) => void;
}

export function HITLApprovalWidget({
  itemId,
  sessionId,
  timestamp,
  hitlData,
  status,
  onApprove,
  onReject,
}: HITLApprovalWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(hitlData.editableContent);
  const [feedback, setFeedback] = useState("");

  const handleApprove = () => {
    const modifiedContent = isEditing && editedContent !== hitlData.originalContent
      ? editedContent
      : undefined;
    onApprove(itemId, modifiedContent, feedback || undefined);
  };

  const handleReject = () => {
    if (!feedback.trim()) {
      alert("Пожалуйста, укажите причину отклонения");
      return;
    }
    onReject(itemId, feedback);
  };

  const isWaiting = status === "WAITING_APPROVAL";
  const isApproved = status === "APPROVED";
  const isRejected = status === "REJECTED";

  // Title based on type
  const titleText = hitlData.type === "PLAN_APPROVAL"
    ? "Утверждение плана работы"
    : "Решение о декомпозиции задачи";

  const iconColor = isApproved ? "text-green-600" : isRejected ? "text-red-600" : "text-blue-600";
  const bgColor = isApproved ? "bg-green-50" : isRejected ? "bg-red-50" : "bg-blue-50";
  const borderColor = isApproved ? "border-green-300" : isRejected ? "border-red-300" : "border-blue-300";

  return (
    <div className={`flex justify-start flex-col items-start w-full`}>
      <div className={`max-w-[80%] rounded-lg border-2 ${borderColor} ${bgColor} p-4 shadow-md`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`${iconColor} font-semibold text-lg flex items-center gap-2`}>
            {isApproved && <CheckIcon className="w-5 h-5" />}
            {isRejected && <Cross2Icon className="w-5 h-5" />}
            {isWaiting && <Pencil1Icon className="w-5 h-5" />}
            <span>{titleText}</span>
          </div>
          <span className="text-xs text-gray-500 ml-auto">{timestamp}</span>
        </div>

        {/* Question */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-800 mb-2">{hitlData.question}</p>
        </div>

        {/* Metadata (if available) */}
        {hitlData.metadata && (
          <div className="mb-4 bg-white rounded p-3 text-xs border border-gray-200">
            {hitlData.metadata.complexity && (
              <div className="mb-1">
                <span className="font-semibold">Сложность:</span> {hitlData.metadata.complexity}
              </div>
            )}
            {hitlData.metadata.estimatedSteps && (
              <div className="mb-1">
                <span className="font-semibold">Шагов:</span> {hitlData.metadata.estimatedSteps}
              </div>
            )}
            {hitlData.metadata.reasoning && (
              <div>
                <span className="font-semibold">Обоснование:</span> {hitlData.metadata.reasoning}
              </div>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="mb-4">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded text-sm font-mono min-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Отредактируйте содержимое..."
            />
          ) : (
            <div className="bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap text-sm font-mono">
              {isWaiting ? editedContent : hitlData.editableContent}
            </div>
          )}
        </div>

        {/* User Feedback (if exists) */}
        {hitlData.userFeedback && (
          <div className="mb-4 bg-gray-100 rounded p-3 text-sm border border-gray-300">
            <span className="font-semibold">Комментарий пользователя:</span>
            <p className="mt-1">{hitlData.userFeedback}</p>
          </div>
        )}

        {/* Actions (only when waiting) */}
        {isWaiting && (
          <div>
            {/* Feedback Input */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Комментарий (опционально):
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Добавьте комментарий..."
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-1"
              >
                <Pencil1Icon />
                {isEditing ? "Завершить редактирование" : "Редактировать"}
              </button>

              <button
                onClick={handleApprove}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1 font-semibold"
              >
                <CheckIcon />
                Утвердить
              </button>

              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1 font-semibold"
              >
                <Cross2Icon />
                Отклонить
              </button>
            </div>
          </div>
        )}

        {/* Status Messages (when approved/rejected) */}
        {isApproved && (
          <div className="text-sm font-semibold text-green-700">
            ✓ Утверждено
            {hitlData.decision === "modified" && " (с изменениями)"}
          </div>
        )}
        {isRejected && (
          <div className="text-sm font-semibold text-red-700">
            ✗ Отклонено
          </div>
        )}
      </div>
    </div>
  );
}
