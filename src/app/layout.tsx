import type { Metadata } from 'next'
import { Lexend, Source_Sans_3 } from 'next/font/google'
import './globals.css'

/**
 * The Secured Lending Options typefaces, as used on sloptions.co.uk: Lexend
 * for headings, Source Sans 3 for body text.
 *
 * Loaded through next/font, which serves them from this domain rather than
 * from Google. That keeps the client portal off a third-party request on a
 * page that is only ever reached by a private link.
 *
 * Only the weights their own site loads are pulled in.
 */
const heading = Lexend({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const body = Source_Sans_3({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Case Document Chaser',
    template: '%s · Secured Lending Options',
  },
  description: 'Document collection for Secured Lending Options.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en-GB"
      className={`${heading.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
