import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Torneos de deportes de contacto: llaves, puntaje en vivo y pantallas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
