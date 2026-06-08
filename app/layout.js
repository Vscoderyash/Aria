import './globals.css'

export const metadata = {
  title: 'Aria AI',
  description: 'Self-evolving AI by Yash',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
