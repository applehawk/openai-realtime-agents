// 'use client';

// import React, { useState, useEffect } from 'react';
// import { useAuth } from '@/app/contexts/AuthContext';

// interface ContainerStatus {
//   status: string;
//   running: boolean;
//   port?: number;
//   health?: string;
//   container_id?: string;
//   container_name?: string;
// }

// interface TestResult {
//   timestamp: string;
//   action: string;
//   success: boolean;
//   message: string;
//   data?: any;
// }

// export default function TestGooglePage() {
//   const { user, googleConnected, connectGoogle, disconnectGoogle, checkGoogleStatus } = useAuth();
//   const [containerStatus, setContainerStatus] = useState<ContainerStatus | null>(null);
//   const [mcpConnected, setMcpConnected] = useState<boolean>(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [testResults, setTestResults] = useState<TestResult[]>([]);
//   const [emailTo, setEmailTo] = useState<string>('');
//   const [emailSubject, setEmailSubject] = useState<string>('Test from MCP Google');
//   const [emailBody, setEmailBody] = useState<string>('This is a test email sent via MCP Streaming HTTP!');

//   useEffect(() => {
//     if (user?.email) {
//       setEmailTo(user.email);
//     }
//   }, [user]);

//   useEffect(() => {
//     checkContainer();
//     checkMCPConnection();
//   }, []);

//   const addTestResult = (action: string, success: boolean, message: string, data?: any) => {
//     const result: TestResult = {
//       timestamp: new Date().toISOString(),
//       action,
//       success,
//       message,
//       data,
//     };
//     setTestResults(prev => [result, ...prev]);
//   };

//   const checkMCPConnection = async () => {
//     try {
//       const response = await fetch('/api/mcp/status', {
//         credentials: 'include',
//       });

//       if (response.ok) {
//         const data = await response.json();
//         setMcpConnected(data.connected);
//         addTestResult('Check MCP Connection', data.connected, data.connected ? 'MCP is connected' : 'MCP is not connected', data);
//       } else {
//         setMcpConnected(false);
//         addTestResult('Check MCP Connection', false, 'Failed to check MCP status');
//       }
//     } catch (error: any) {
//       setMcpConnected(false);
//       addTestResult('Check MCP Connection', false, `Error: ${error.message}`);
//     }
//   };

//   const checkContainer = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const response = await fetch('/api/containers/status', {
//         credentials: 'include',
//       });

//       if (!response.ok) {
//         throw new Error('Failed to get container status');
//       }

//       const data = await response.json();
//       setContainerStatus(data);
//       addTestResult('Load Container Status', true, `Container status: ${data.status}`, data);
//     } catch (err) {
//       const errorMsg = err instanceof Error ? err.message : 'Unknown error';
//       setError(errorMsg);
//       addTestResult('Load Container Status', false, `Error: ${errorMsg}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleStartContainer = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const response = await fetch('/api/containers/start', {
//         method: 'POST',
//         credentials: 'include',
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(errorText || 'Failed to start container');
//       }

//       const data = await response.json();
//       addTestResult('Start Container', true, 'Container started successfully', data);
//       await checkContainer();
//     } catch (err) {
//       const errorMsg = err instanceof Error ? err.message : 'Failed to start container';
//       setError(errorMsg);
//       addTestResult('Start Container', false, `Error: ${errorMsg}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleStopContainer = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const response = await fetch('/api/containers/stop', {
//         method: 'POST',
//         credentials: 'include',
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(errorText || 'Failed to stop container');
//       }

//       const data = await response.json();
//       addTestResult('Stop Container', true, 'Container stopped successfully', data);
//       await checkContainer();
//     } catch (err) {
//       const errorMsg = err instanceof Error ? err.message : 'Failed to stop container';
//       setError(errorMsg);
//       addTestResult('Stop Container', false, `Error: ${errorMsg}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleInitializeMCP = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const response = await fetch('/api/mcp/initialize', {
//         method: 'POST',
//         credentials: 'include',
//       });

//       if (response.ok) {
//         const data = await response.json();
//         addTestResult('Initialize MCP', true, 'MCP server initialized successfully', data);
//         await checkMCPConnection();
//       } else {
//         const error = await response.json();
//         addTestResult('Initialize MCP', false, `Failed: ${error.error || 'Unknown error'}`, error);
//       }
//     } catch (err) {
//       const errorMsg = err instanceof Error ? err.message : 'Failed to initialize MCP';
//       setError(errorMsg);
//       addTestResult('Initialize MCP', false, `Error: ${errorMsg}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const testGmail = async () => {
//     if (!emailTo) {
//       setError('Please enter recipient email');
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     try {
//       const response = await fetch('/api/test-mcp-email', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         credentials: 'include',
//         body: JSON.stringify({
//           to: emailTo,
//           subject: emailSubject,
//           body: emailBody,
//         }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || 'Failed to send email');
//       }

//       const data = await response.json();
//       addTestResult('Send Email', true, 'Email sent successfully via MCP', data);
//       alert('Email sent successfully!');
//     } catch (err) {
//       const errorMsg = err instanceof Error ? err.message : 'Failed to send email';
//       setError(errorMsg);
//       addTestResult('Send Email', false, `Error: ${errorMsg}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const clearResults = () => {
//     setTestResults([]);
//     setError(null);
//   };

//   return (
//     <div className="min-h-screen bg-gray-100 p-8">
//       <div className="max-w-6xl mx-auto">
//         <h1 className="text-3xl font-bold mb-8 text-gray-800">Google MCP Services Test</h1>

//         {/* User Info Panel */}
//         <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//           <h2 className="text-xl font-semibold mb-4">User Information</h2>
//           {user ? (
//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <p className="text-sm text-gray-600">Username</p>
//                 <p className="text-lg font-semibold">{user.username}</p>
//               </div>
//               <div>
//                 <p className="text-sm text-gray-600">Email</p>
//                 <p className="text-lg font-semibold">{user.email}</p>
//               </div>
//             </div>
//           ) : (
//             <p className="text-gray-500">Not logged in</p>
//           )}
//         </div>

//         {/* Google Connection Panel */}
//         <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//           <h2 className="text-xl font-semibold mb-4">Google Connection</h2>
//           <div className="flex items-center gap-4 mb-4">
//             <p className="text-sm text-gray-600">Status:</p>
//             {googleConnected ? (
//               <span className="text-green-600 font-semibold">✓ Connected</span>
//             ) : (
//               <span className="text-red-600 font-semibold">✗ Not Connected</span>
//             )}
//           </div>
//           <div className="flex gap-4">
//             {!googleConnected ? (
//               <button
//                 onClick={connectGoogle}
//                 disabled={loading}
//                 className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
//               >
//                 Connect Google Account
//               </button>
//             ) : (
//               <button
//                 onClick={disconnectGoogle}
//                 disabled={loading}
//                 className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
//               >
//                 Disconnect Google
//               </button>
//             )}
//             <button
//               onClick={checkGoogleStatus}
//               disabled={loading}
//               className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
//             >
//               Refresh Status
//             </button>
//           </div>
//         </div>

//         {/* Status Panel */}
//         <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//           <h2 className="text-xl font-semibold mb-4">MCP Container & Connection Status</h2>
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
//             <div>
//               <p className="text-sm text-gray-600">Container Status</p>
//               <p className="text-lg font-semibold">
//                 {containerStatus ? (
//                   <span className={containerStatus.running ? 'text-green-600' : 'text-red-600'}>
//                     {containerStatus.status}
//                   </span>
//                 ) : (
//                   'Unknown'
//                 )}
//               </p>
//             </div>
//             <div>
//               <p className="text-sm text-gray-600">MCP Connection</p>
//               <p className="text-lg font-semibold">
//                 <span className={mcpConnected ? 'text-green-600' : 'text-red-600'}>
//                   {mcpConnected ? 'Connected' : 'Not Connected'}
//                 </span>
//               </p>
//             </div>
//             {containerStatus?.port && (
//               <div>
//                 <p className="text-sm text-gray-600">Port</p>
//                 <p className="text-lg font-semibold">{containerStatus.port}</p>
//               </div>
//             )}
//             {containerStatus?.health && (
//               <div>
//                 <p className="text-sm text-gray-600">Health</p>
//                 <p className="text-lg font-semibold">{containerStatus.health}</p>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Container Control Panel */}
//         <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//           <h2 className="text-xl font-semibold mb-4">Container Controls</h2>
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//             <button
//               onClick={checkContainer}
//               disabled={loading}
//               className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
//             >
//               {loading ? 'Loading...' : 'Refresh Status'}
//             </button>
//             <button
//               onClick={handleStartContainer}
//               disabled={loading || containerStatus?.running}
//               className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
//             >
//               Start Container
//             </button>
//             <button
//               onClick={handleStopContainer}
//               disabled={loading || !containerStatus?.running}
//               className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
//             >
//               Stop Container
//             </button>
//             <button
//               onClick={handleInitializeMCP}
//               disabled={loading || !containerStatus?.running}
//               className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
//             >
//               Initialize MCP
//             </button>
//           </div>
//         </div>

//         {/* Email Test Panel */}
//         <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//           <h2 className="text-xl font-semibold mb-4">Send Test Email via MCP</h2>
//           <div className="space-y-4">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-2">
//                 Recipient Email
//               </label>
//               <input
//                 type="email"
//                 value={emailTo}
//                 onChange={(e) => setEmailTo(e.target.value)}
//                 placeholder="recipient@example.com"
//                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-2">
//                 Subject
//               </label>
//               <input
//                 type="text"
//                 value={emailSubject}
//                 onChange={(e) => setEmailSubject(e.target.value)}
//                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-2">
//                 Body
//               </label>
//               <textarea
//                 value={emailBody}
//                 onChange={(e) => setEmailBody(e.target.value)}
//                 rows={4}
//                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//               />
//             </div>
//             <button
//               onClick={testGmail}
//               disabled={loading || !mcpConnected || !emailTo}
//               className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-6 rounded disabled:opacity-50"
//             >
//               {loading ? 'Sending...' : 'Send Test Email'}
//             </button>
//             <p className="text-sm text-gray-600">
//               Note: MCP server must be initialized and connected before sending email
//             </p>
//           </div>
//         </div>

//         {/* Error Display */}
//         {error && (
//           <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
//             <p className="text-red-800 font-semibold">Error:</p>
//             <p className="text-red-700">{error}</p>
//           </div>
//         )}

//         {/* Test Results Log */}
//         <div className="bg-white rounded-lg shadow-md p-6">
//           <div className="flex justify-between items-center mb-4">
//             <h2 className="text-xl font-semibold">Test Results Log</h2>
//             <button
//               onClick={clearResults}
//               className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-1 px-4 rounded text-sm"
//             >
//               Clear Log
//             </button>
//           </div>
//           <div className="space-y-2 max-h-96 overflow-y-auto">
//             {testResults.length === 0 ? (
//               <p className="text-gray-500 text-center py-4">No test results yet</p>
//             ) : (
//               testResults.map((result, index) => (
//                 <div
//                   key={index}
//                   className={`p-3 rounded border ${
//                     result.success
//                       ? 'bg-green-50 border-green-200'
//                       : 'bg-red-50 border-red-200'
//                   }`}
//                 >
//                   <div className="flex justify-between items-start">
//                     <div className="flex-1">
//                       <p className="font-semibold">
//                         {result.action}
//                         <span
//                           className={`ml-2 text-sm ${
//                             result.success ? 'text-green-600' : 'text-red-600'
//                           }`}
//                         >
//                           {result.success ? '✓' : '✗'}
//                         </span>
//                       </p>
//                       <p className="text-sm text-gray-700">{result.message}</p>
//                       {result.data && (
//                         <details className="mt-2">
//                           <summary className="text-xs text-gray-600 cursor-pointer">
//                             Show details
//                           </summary>
//                           <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
//                             {JSON.stringify(result.data, null, 2)}
//                           </pre>
//                         </details>
//                       )}
//                     </div>
//                     <p className="text-xs text-gray-500 ml-4">
//                       {new Date(result.timestamp).toLocaleTimeString()}
//                     </p>
//                   </div>
//                 </div>
//               ))
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
