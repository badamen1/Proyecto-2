import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/shared/layout/Navbar";
import Footer from "@/shared/layout/Footer";
import FloatingButtons from "@/shared/ui/FloatingButtons";
import ChatbotWidget from "@/features/chatbot/components/ChatbotWidget";

export const metadata: Metadata = {
  title: "Laboratorio Clínico BIOANALISIS",
  description: "Laboratorio clínico de confianza en Quibdó, Chocó. Ofrecemos análisis clínicos con precisión y tecnología de vanguardia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <FloatingButtons />
        <ChatbotWidget />
      </body>
    </html>
  );
}
