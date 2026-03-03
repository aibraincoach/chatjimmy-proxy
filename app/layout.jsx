import './globals.css';

export const metadata = {
  title: 'ChatJimmy Proxy Inspector',
  description: 'Educational Next.js proxy for streaming ChatJimmy responses.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
