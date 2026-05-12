/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

const LOGO_URL =
  'https://phkwivrcuuvzpgzvvmkv.supabase.co/storage/v1/object/public/email-assets/snapshot-logo.png'

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your SnapShot verification code</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Container style={card}>
          <Section style={logoSection}>
            <Img src={LOGO_URL} width="140" height="40" alt="SnapShot" style={logo} />
          </Section>
          <Section style={accentLine} />
          <Heading style={h1}>Verification code</Heading>
          <Text style={text}>Use the code below to confirm your identity:</Text>
          <Section style={codeSection}>
            <Text style={codeStyle}>{token}</Text>
          </Section>
          <Text style={footer}>
            This code will expire shortly. If you didn't request this, you can safely ignore it.
          </Text>
        </Container>
        <Text style={brand}>© {new Date().getFullYear()} SnapShot · AI Product Photography</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: 'hsl(0, 0%, 2%)',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  padding: '40px 0',
}
const wrapper = { maxWidth: '520px', margin: '0 auto', padding: '0 20px' }
const card = {
  backgroundColor: 'hsl(0, 0%, 4%)',
  borderRadius: '16px',
  border: '1px solid hsl(0, 0%, 10%)',
  padding: '48px 40px 40px',
}
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logo = { display: 'inline-block' as const }
const accentLine = {
  height: '2px',
  background: 'linear-gradient(90deg, hsl(252, 85%, 62%), hsl(210, 85%, 55%))',
  borderRadius: '1px',
  marginBottom: '32px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#fafafa',
  fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
}
const text = { fontSize: '15px', color: '#999999', lineHeight: '1.6', margin: '0 0 28px' }
const codeSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
  backgroundColor: 'hsl(0, 0%, 6%)',
  borderRadius: '10px',
  padding: '20px',
  border: '1px solid hsl(0, 0%, 12%)',
}
const codeStyle = {
  fontFamily: "'SF Mono', 'Fira Code', Courier, monospace",
  fontSize: '28px',
  fontWeight: '700' as const,
  color: 'hsl(252, 85%, 72%)',
  letterSpacing: '0.15em',
  margin: '0',
}
const footer = { fontSize: '12px', color: '#555555', margin: '0', lineHeight: '1.5' }
const brand = { fontSize: '11px', color: '#444444', textAlign: 'center' as const, margin: '24px 0 0' }
