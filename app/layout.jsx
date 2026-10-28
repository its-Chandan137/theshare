import './globals.css'

export const metadata = {
  title: 'TheShare - Fast File Transfer',
  description: 'Share files between laptop and phone instantly. Scan QR code to connect.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased selection:bg-brand-500 selection:text-white">{children}</body>
    </html>
  )
}
