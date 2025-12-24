import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Konfigurasi Metadata Standar Perusahaan
export const metadata: Metadata = {
  title: {
    template: "%s | SmartRewards", // Hasilnya nanti: "Halaman Login | SmartRewards"
    default: "SmartRewards - PT Smartlab Indonesia", // Judul default jika halaman tidak punya judul khusus
  },
  description: "Platform resmi SmartRewards oleh PT Smartlab Indonesia.",
  generator: "Next.js",
  applicationName: "SmartRewards",
  keywords: ["SmartRewards", "PT Smartlab Indonesia", "Employee Benefits", "Rewards System"],
  authors: [{ name: "IT Department PT Smartlab Indonesia" }],
  
  // Konfigurasi Logo (Favicon)
  icons: {
    icon: "/logo.png", // Pastikan Anda menaruh file 'logo.png' di folder 'public'
    shortcut: "/logo.png",
    apple: "/apple-icon.png", // Opsional: icon khusus untuk shortcut di iPhone/iPad
  },
  
  // Konfigurasi Open Graph (Tampilan saat link dibagikan di WA/Sosmed)
  openGraph: {
    title: "SmartRewards - PT Smartlab Indonesia",
    description: "Sistem Manajemen Reward Terintegrasi",
    siteName: "SmartRewards",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-slate-900`}
      >
        {children}
      </body>
    </html>
  );
}