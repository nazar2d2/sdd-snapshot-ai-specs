/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

const LOGO_URL =
  'https://phkwivrcuuvzpgzvvmkv.supabase.co/storage/v1/object/public/email-assets/snapshot-logo.png'

export const InviteEmail = ({
  siteName: _siteName,
  siteUrl: _siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to SnapShot</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Container style={card}>
          <Section style={logoSection}>
            <Img src={LOGO_URL} width="140" height="40" alt="SnapShot" style={logo} />
          </Section>
          <Section style={accentLine} />
          <Heading style={h1}>You're invited</Heading>
          <Text style={text}>
            You've been invited to join SnapShot — AI-powered product photography. Accept the invitation to create your account.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={confirmationUrl}>
              Accept Invitation
            </Button>
          </Section>
          <Text style={footer}>
            If you weren't expecting this, you can safely ignore this email.
          </Text>
        </Container>
        <Text style={brand}>© {new Date().getFullYear()} SnapShot · AI Product Photography</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const buttonSection = { textAlign: 'center' as const, marginBottom: '32px' }
const button = {
  backgroundColor: 'hsl(252, 85%, 62%)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '10px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  boxShadow: '0 4px 20px hsla(252, 85%, 62%, 0.4)',
}
const footer = { fontSize: '12px', color: '#555555', margin: '0', lineHeight: '1.5' }
const brand = { fontSize: '11px', color: '#444444', textAlign: 'center' as const, margin: '24px 0 0' }
