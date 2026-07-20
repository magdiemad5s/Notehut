import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NoteHut \u2014 AI Exam Builder",
  description: "Adaptive AI-powered document analysis and exam generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={inter.variable}
      data-scroll-behavior="smooth"
    >
      <body className="font-sans antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
