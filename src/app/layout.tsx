import type { Metadata } from "next";
import "./globals.css";
import "./lib/envSetup";
import { AuthProvider } from "./contexts/AuthContext";
import { RagServerStatusComponent } from "./components/RagServerStatus";
import { initializeApplication } from "./lib/appInitializer";

export const metadata: Metadata = {
  title: "Realtime API Agents",
  description: "A demo app from OpenAI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Инициализируем приложение при старте
  initializeApplication();

  return (
    <html lang="en">
      <body className={`antialiased`}>
        <AuthProvider>
          {children}
          <RagServerStatusComponent />
        </AuthProvider>
      </body>
    </html>
  );
}
