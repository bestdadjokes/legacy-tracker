import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const garet = localFont({
  src: [
    { path: "./fonts/Garet-Book.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Garet-Heavy.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-garet",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wellness Tracker | Legacy Training",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/favicon.ico?v=2", sizes: "32x32" }],
    apple: [{ url: "/apple-icon.png?v=2", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${garet.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
