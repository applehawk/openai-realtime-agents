"use client";

import { useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";

/**
 * Hook to handle MCP (Model Context Protocol) tool events from the RealtimeSession.
 *
 * This hook manages three main types of MCP events:
 *
 * 1. Session-level events (emitted by RealtimeSession):
 *    - mcp_tools_changed: Fired when the list of available MCP tools changes
 *    - mcp_tool_call_completed: Fired when an MCP tool call finishes execution
 *
 * 2. Server events for MCP call arguments (via transport_event):
 *    - response.mcp_call.arguments.delta: Streaming chunks of MCP tool arguments
 *    - response.mcp_call.arguments.done: MCP tool arguments have been fully received
 *
 * 3. Server events for MCP call status (via transport_event):
 *    - response.mcp_call.in_progress: MCP tool call execution has started
 *    - response.mcp_call.completed: MCP tool call execution finished successfully
 *    - response.mcp_call.failed: MCP tool call execution failed with an error
 */
export function useMcpToolSession() {
  const {
    addTranscriptBreadcrumb,
  } = useTranscript();

  const { logServerEvent } = useEvent();

  // Track MCP tool calls in progress (keyed by call_id or item_id)
  const mcpCallsInProgressRef = useRef<Map<string, {
    name: string;
    argumentsBuffer: string;
    itemId: string;
  }>>(new Map());

  /* ----------------------- Session-level MCP Event Handlers ------------------------- */

  /**
   * Handles the mcp_tools_changed event.
   * Fired when the available MCP tools list changes (e.g., when a new MCP server is connected).
   *
   * @param tools - Array of available MCP tools with their definitions
   */
  function handleMcpToolsChanged(tools: any) {
    console.log("[MCP] Tools changed:", tools);
    logServerEvent({
      type: 'mcp_tools_changed',
      tools: tools,
      count: Array.isArray(tools) ? tools.length : 0,
    });

    addTranscriptBreadcrumb('MCP Tools Changed', {
      toolCount: Array.isArray(tools) ? tools.length : 0,
      tools: tools,
    });
  }

  /**
   * Handles the mcp_tool_call_completed event.
   * Fired when an MCP tool call has completed execution and returned a result.
   *
   * @param _details - Contains context about the completed call (unused)
   * @param toolCall - The tool call object with name, arguments, and call_id
   * @param result - The result returned from the MCP tool execution
   */
  function handleMcpToolCallCompleted(_details: any, toolCall: any, result: any) {
    console.log("[MCP] Tool call completed:", toolCall, result);

    const callId = toolCall?.call_id || toolCall?.id;

    logServerEvent({
      type: 'mcp_tool_call_completed',
      toolName: toolCall?.name,
      callId: callId,
      result: result,
    });

    // Clean up from our tracking map
    if (callId) {
      mcpCallsInProgressRef.current.delete(callId);
    }

    addTranscriptBreadcrumb(`MCP Tool Completed: ${toolCall?.name}`, {
      callId: callId,
      result: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
    });
  }

  /* ----------------------- Server Event Handlers (via transport_event) ------------------------- */

  /**
   * Handles response.mcp_call.arguments.delta event.
   * Fired during streaming of MCP tool call arguments. Each delta contains a chunk
   * of the arguments JSON string being constructed.
   *
   * @param event - Server event containing the delta chunk
   */
  function handleMcpCallArgumentsDelta(event: any) {
    const { item_id, call_id, delta, name, tool_name } = event;
    const id = call_id || item_id;

    if (!id) return;

    logServerEvent(event);

    // Try multiple fields for the tool name
    const toolName = name || tool_name || event.tool?.name || 'unknown';

    // Initialize or update the arguments buffer
    const existing = mcpCallsInProgressRef.current.get(id);
    if (existing) {
      existing.argumentsBuffer += delta || '';
      // Update name if we got a better one
      if (toolName !== 'unknown' && existing.name === 'unknown') {
        existing.name = toolName;
      }
    } else {
      mcpCallsInProgressRef.current.set(id, {
        name: toolName,
        argumentsBuffer: delta || '',
        itemId: item_id || id,
      });
    }

    console.log(`[MCP] Arguments delta for ${toolName} (${id}):`, delta);
  }

  /**
   * Handles response.mcp_call.arguments.done event.
   * Fired when all argument chunks have been received and the complete arguments
   * string is available.
   *
   * @param event - Server event with complete arguments
   */
  function handleMcpCallArgumentsDone(event: any) {
    const { item_id, call_id, arguments: args } = event;
    const id = call_id || item_id;

    if (!id) return;

    logServerEvent(event);

    const callInfo = mcpCallsInProgressRef.current.get(id);
    const finalArguments = args || callInfo?.argumentsBuffer || '';

    console.log(`[MCP] Arguments done for ${id}:`, finalArguments);

    // Parse arguments if it's a JSON string
    let parsedArgs = finalArguments;
    if (typeof finalArguments === 'string') {
      try {
        parsedArgs = JSON.parse(finalArguments);
      } catch {
        console.warn('[MCP] Failed to parse arguments:', finalArguments);
      }
    }

    addTranscriptBreadcrumb(`MCP Tool Arguments Ready: ${callInfo?.name || 'unknown'}`, {
      callId: id,
      arguments: parsedArgs,
    });
  }

  /**
   * Handles response.mcp_call.in_progress event.
   * Fired when an MCP tool call execution has started on the server.
   *
   * @param event - Server event indicating execution start
   */
  function handleMcpCallInProgress(event: any) {
    const { item_id, call_id, name, tool_name } = event;
    const id = call_id || item_id;

    // Try to get the name from the event, tracking map, or use a fallback
    const callInfo = id ? mcpCallsInProgressRef.current.get(id) : undefined;
    const toolName = name || tool_name || event.tool?.name || callInfo?.name || 'unknown';

    // Update the tracking map with the tool name if we have it
    if (id && toolName !== 'unknown') {
      if (callInfo) {
        callInfo.name = toolName;
      } else {
        mcpCallsInProgressRef.current.set(id, {
          name: toolName,
          argumentsBuffer: '',
          itemId: item_id || id,
        });
      }
    }

    console.log(`[MCP] Call in progress: ${toolName} (${id})`, event);

    logServerEvent(event);

    addTranscriptBreadcrumb(`MCP Tool Executing: ${toolName}`, {
      callId: id,
      status: 'in_progress',
    });
  }

  /**
   * Handles response.mcp_call.completed event.
   * Fired when an MCP tool call has successfully completed execution.
   *
   * @param event - Server event with completion details and result
   */
  function handleMcpCallCompleted(event: any) {
    const { item_id, call_id, name, tool_name, output } = event;
    const id = call_id || item_id;

    // Try to get the name from the event, tracking map, or use a fallback
    const callInfo = id ? mcpCallsInProgressRef.current.get(id) : undefined;
    const toolName = name || tool_name || event.tool?.name || callInfo?.name || 'unknown';

    console.log(`[MCP] Call completed: ${toolName} (${id})`, event);

    logServerEvent(event);

    // Clean up from tracking
    if (id) {
      mcpCallsInProgressRef.current.delete(id);
    }

    addTranscriptBreadcrumb(`MCP Tool Success: ${toolName}`, {
      callId: id,
      status: 'completed',
      output: output,
    });
  }

  /**
   * Handles response.mcp_call.failed event.
   * Fired when an MCP tool call execution failed with an error.
   *
   * @param event - Server event with error details
   */
  function handleMcpCallFailed(event: any) {
    const { item_id, call_id, name, tool_name, error } = event;
    const id = call_id || item_id;

    // Try to get the name from the event, tracking map, or use a fallback
    const callInfo = id ? mcpCallsInProgressRef.current.get(id) : undefined;
    const toolName = name || tool_name || event.tool?.name || callInfo?.name || 'unknown';

    console.error(`[MCP] Call failed: ${toolName} (${id})`, error, event);

    logServerEvent({
      type: 'mcp_call_failed',
      name: toolName,
      callId: id,
      error: error,
    });

    // Clean up from tracking
    if (id) {
      mcpCallsInProgressRef.current.delete(id);
    }

    addTranscriptBreadcrumb(`MCP Tool Failed: ${toolName}`, {
      callId: id,
      status: 'failed',
      error: error?.message || error,
    });
  }

  /**
   * Handles response.output_item.added event for MCP calls.
   * This event contains the tool name and item ID, which we need to track.
   */
  function handleMcpItemAdded(event: any) {
    const item = event.item;
    if (!item || item.type !== 'mcp_call') return;

    const itemId = item.id;
    const toolName = item.name;

    if (!itemId || !toolName) return;

    console.log(`[MCP] Item added: ${toolName} (${itemId})`);

    // Store the tool name in our tracking map
    mcpCallsInProgressRef.current.set(itemId, {
      name: toolName,
      argumentsBuffer: '',
      itemId: itemId,
    });

    logServerEvent(event);
  }

  /**
   * Handles response.output_item.done event.
   * Fired when an output item (including function_call items) is completed.
   *
   * @param event - Server event with the completed item details
   */
  function handleOutputItemDone(event: any) {
    const item = event.item;

    if (!item) {
      logServerEvent(event);
      return;
    }

    console.log(`[MCP] Output item done:`, item);

    // Handle function_call completion
    if (item.type === 'function_call') {
      const { id, name, call_id, status, arguments: args, output } = item;
      const itemId = id || call_id;

      logServerEvent(event);

      // Check if this is an error status
      if (status === 'failed' || status === 'error') {
        console.error(`[MCP] Function call failed: ${name} (${itemId})`, event);

        addTranscriptBreadcrumb(`MCP Function Call Failed: ${name}`, {
          callId: itemId,
          status: status,
          arguments: args,
          output: output,
          event: event,
        });

        // Clean up from tracking
        if (itemId) {
          mcpCallsInProgressRef.current.delete(itemId);
        }
      } else if (status === 'completed') {
        console.log(`[MCP] Function call completed: ${name} (${itemId})`);

        // Log the output to help debug issues
        if (output !== undefined) {
          console.log(`[MCP] Function call output for ${name}:`, output);
        } else {
          console.warn(`[MCP] Function call ${name} completed but has no output`);
        }

        addTranscriptBreadcrumb(`MCP Function Call Done: ${name}`, {
          callId: itemId,
          status: status,
          arguments: args,
          hasOutput: output !== undefined,
          outputPreview: output !== undefined
            ? (typeof output === 'string' ? output.substring(0, 100) : JSON.stringify(output).substring(0, 100))
            : 'no output',
        });

        // Keep tracking for a moment to catch any errors that follow
        // We'll clean up when we see the next conversation.item.created or after a timeout
        if (itemId) {
          const callInfo = mcpCallsInProgressRef.current.get(itemId);
          if (callInfo) {
            // Mark as completed but don't delete yet
            (callInfo as any).completedAt = Date.now();

            // Clean up after 5 seconds if no error occurs
            setTimeout(() => {
              if (mcpCallsInProgressRef.current.has(itemId)) {
                console.log(`[MCP] Cleaning up completed call ${name} (${itemId})`);
                mcpCallsInProgressRef.current.delete(itemId);
              }
            }, 5000);
          }
        }
      }
    } else {
      // Log other types of output items
      logServerEvent(event);
    }
  }

  /**
   * Handles conversation.item.created event for function_call_output items.
   * This helps us track when the output from a function call is being added to the conversation.
   */
  function handleFunctionCallOutputCreated(event: any) {
    const item = event.item;
    if (!item || item.type !== 'function_call_output') return false;

    const { id, call_id, output } = item;
    const itemId = call_id || id;

    console.log(`[MCP] Function call output being created for call ${itemId}:`, {
      hasOutput: output !== undefined,
      outputType: typeof output,
      outputLength: typeof output === 'string' ? output.length : 'N/A',
    });

    // Check if the output is problematic
    if (output === undefined || output === null) {
      console.warn(`[MCP] Function call output is ${output} for call ${itemId}`);
    }

    logServerEvent(event);
    return true;
  }

  /**
   * Main handler for MCP-related transport events.
   * Routes server events to the appropriate handler based on event type.
   *
   * @param event - Raw server event from the transport layer
   * @returns true if event was handled, false otherwise
   */
  function handleMcpTransportEvent(event: any): boolean {
    if (!event?.type) return false;

    // Debug: log all MCP-related events to see their structure
    if (event.type?.includes('mcp')) {
      console.log('[MCP Debug] Full event:', JSON.stringify(event, null, 2));
    }

    switch (event.type) {
      case "error": {
        // Check if this error is related to an MCP tool call that was in progress or recently completed
        const hasActiveMcpCalls = mcpCallsInProgressRef.current.size > 0;

        if (hasActiveMcpCalls) {
          const errorObj = event.error || event;
          let errorMessage = 'Unknown MCP error';

          // Collect information about active/recent calls
          const callsInfo = Array.from(mcpCallsInProgressRef.current.entries()).map(([id, info]) => ({
            id,
            name: info.name,
            completedAt: (info as any).completedAt,
            isRecent: (info as any).completedAt && (Date.now() - (info as any).completedAt < 2000),
          }));

          // Check if error object is empty
          if (errorObj && typeof errorObj === 'object') {
            if (Object.keys(errorObj.error || errorObj).length === 0) {
              errorMessage = 'Empty error object received during/after MCP tool execution';
              console.warn('[MCP] Empty error during tool execution. Active/recent calls:', callsInfo);
            } else if (errorObj.message && errorObj.message !== '{}') {
              errorMessage = errorObj.message;
            } else if (errorObj.error) {
              errorMessage = typeof errorObj.error === 'string'
                ? errorObj.error
                : JSON.stringify(errorObj.error);
            }
          }

          console.error('[MCP] Error during/after tool execution:', errorMessage, event);

          // Log error with context about active calls
          logServerEvent({
            type: 'mcp_error',
            message: errorMessage,
            activeCalls: callsInfo,
            raw: event,
          });

          // Add breadcrumb for any active MCP calls
          mcpCallsInProgressRef.current.forEach((info, id) => {
            const isRecentlyCompleted = (info as any).completedAt && (Date.now() - (info as any).completedAt < 2000);
            addTranscriptBreadcrumb(`MCP Tool Error: ${info.name}`, {
              callId: id,
              status: isRecentlyCompleted ? 'error_after_completion' : 'error',
              error: errorMessage,
              timing: isRecentlyCompleted ? 'error occurred shortly after completion' : 'error during execution',
            });
          });

          // Clean up all active calls since we hit an error
          mcpCallsInProgressRef.current.clear();

          return true;
        }
        return false;
      }

      case "conversation.item.created": {
        // Check if this is a function_call_output being added
        if (event.item?.type === 'function_call_output') {
          return handleFunctionCallOutputCreated(event);
        }
        return false;
      }

      case "response.output_item.added":
      case "conversation.item.added":
        // Check if this is an MCP call and handle it
        if (event.item?.type === 'mcp_call') {
          handleMcpItemAdded(event);
          return true;
        }
        return false;

      case "response.output_item.done":
        // Handle completion of function_call items (including MCP tools)
        handleOutputItemDone(event);
        return true;

      case "response.mcp_call.arguments.delta":
      case "response.mcp_call_arguments.delta":
        handleMcpCallArgumentsDelta(event);
        return true;

      case "response.mcp_call.arguments.done":
      case "response.mcp_call_arguments.done":
        handleMcpCallArgumentsDone(event);
        return true;

      case "response.mcp_call.in_progress":
        handleMcpCallInProgress(event);
        return true;

      case "response.mcp_call.completed":
        handleMcpCallCompleted(event);
        return true;

      case "response.mcp_call.failed":
        handleMcpCallFailed(event);
        return true;

      default:
        return false;
    }
  }

  const handlersRef = useRef({
    handleMcpToolsChanged,
    handleMcpToolCallCompleted,
    handleMcpTransportEvent,
  });

  return handlersRef;
}