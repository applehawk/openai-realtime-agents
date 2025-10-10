'use client';

import React, { Suspense } from "react";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useRouter } from "next/navigation";
import App from "./App";

function ProtectedApp() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#94a3b8'
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    router.push('/auth/login');
    return null;
  }

  return (
    <TranscriptProvider>
      <EventProvider>
        <App />
      </EventProvider>
    </TranscriptProvider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProtectedApp />
    </Suspense>
  );
}
