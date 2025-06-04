import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'DataPEG | Data Engineering & BI',
  description: 'Simple, powerful data solutions for modern businesses.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-800">
        <header className="bg-gray-900 text-white p-4">
          <nav className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">DataPEG</h1>
            <div className="space-x-4">
              <Link href="/">Home</Link>
              <Link href="/about">About</Link>
              <Link href="/services">Services</Link>
              <Link href="/projects">Projects</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </nav>
        </header>

        <main className="max-w-6xl mx-auto p-6">{children}</main>

        <footer className="bg-gray-100 text-center text-sm p-4 mt-10">
          &copy; {new Date().getFullYear()} DataPEG (Pty) Ltd. All rights reserved.
        </footer>
      </body>
    </html>
  )
}
