// import { NextRequest, NextResponse } from 'next/server';
// import { mcpServerManager } from '@/app/agentConfigs/severstalAssistantAgent';

// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();
//     const { to, subject, body: emailBody } = body;

//     if (!to || !subject || !emailBody) {
//       return NextResponse.json(
//         { error: 'Missing required fields: to, subject, body' },
//         { status: 400 }
//       );
//     }

//     // Check if MCP server is connected
//     if (!mcpServerManager.isServerConnected()) {
//       return NextResponse.json(
//         { error: 'MCP server is not connected. Please initialize it first.' },
//         { status: 503 }
//       );
//     }

//     const mcpServer = mcpServerManager.getServer();
//     if (!mcpServer) {
//       return NextResponse.json(
//         { error: 'MCP server instance not found' },
//         { status: 503 }
//       );
//     }

//     console.log('[test-mcp-email] Attempting to send email via Streaming HTTP MCP:', { to, subject });

//     try {
//       // Get list of available tools from MCP server
//       const tools = await mcpServer.listTools();
//       console.log('[test-mcp-email] Available MCP tools:', tools.map((t: any) => t.name));

//       // Find email sending tool
//       // Prefer exact match first, then case-insensitive contains, then a safer fallback
//       const emailTool =
//         tools.find((t: any) => t.name === 'gmail_send_message') ||
//         tools.find((t: any) => typeof t.name === 'string' && t.name.toLowerCase() === 'gmail_send_message') ||
//         tools.find((t: any) => typeof t.name === 'string' && t.name.toLowerCase().includes('gmail_send_message')) ||
//         // fallback: contains gmail OR (contains send AND contains email) -- with correct parentheses
//         tools.find(
//           (t: any) =>
//             typeof t.name === 'string' &&
//             (t.name.toLowerCase().includes('gmail') ||
//               (t.name.toLowerCase().includes('send') && t.name.toLowerCase().includes('email')))
//         );


//       if (!emailTool) {
//         return NextResponse.json(
//           {
//             error: 'No email sending tool found in MCP server',
//             availableTools: tools.map((t: any) => t.name),
//           },
//           { status: 404 }
//         );
//       }

//       console.log('[test-mcp-email] Using MCP tool:', emailTool.name);

//       // Call the tool through Streaming HTTP MCP
//       const result = await mcpServer.callTool(emailTool.name, {
//         to,
//         subject,
//         body: emailBody,
//       });

//       console.log('[test-mcp-email] Email sent successfully:', result);

//       return NextResponse.json({
//         success: true,
//         message: 'Email sent successfully via Streaming HTTP MCP',
//         toolUsed: emailTool.name,
//         result,
//       });
//     } catch (toolError: any) {
//       console.error('[test-mcp-email] Error calling MCP tool:', toolError);
//       return NextResponse.json(
//         {
//           error: 'Failed to send email via MCP',
//           details: toolError.message,
//           stack: toolError.stack,
//         },
//         { status: 500 }
//       );
//     }
//   } catch (error: any) {
//     console.error('[test-mcp-email] Error:', error);
//     return NextResponse.json(
//       {
//         error: 'Internal server error',
//         details: error.message,
//         stack: error.stack,
//       },
//       { status: 500 }
//     );
//   }
// }
