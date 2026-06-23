// src/emails/low-stock-email.tsx
// Purpose: React Email template for low stock notifications.

import React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components';

interface LowStockEmailProps {
  shopName: string;
  productName: string;
  currentQuantity: number;
  reorderLevel: number;
  stockInUrl: string;
}

export default function LowStockEmail({
  shopName = 'My Shop',
  productName = 'Product A',
  currentQuantity = 5,
  reorderLevel = 10,
  stockInUrl = 'http://localhost:3000/dashboard/inventory',
}: LowStockEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`⚠️ Low stock: ${productName} — ${shopName}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Text style={logoText}>SmartKiosk</Text>
            <Text style={shopNameText}>{shopName}</Text>
          </Section>

          <Hr style={hr} />

          {/* Banner */}
          <Section style={alertBanner}>
            <Heading style={bannerHeading}>⚠️ Stock Running Low</Heading>
          </Section>

          {/* Body */}
          <Section style={contentSection}>
            <Text style={introText}>
              The inventory level for the following product has fallen below its reorder point:
            </Text>

            <Section style={productCard}>
              <Text style={productTitle}>{productName}</Text>
              <Hr style={cardHr} />
              <table style={tableStyle}>
                <tbody>
                  <tr>
                    <td style={labelCell}>Current Stock:</td>
                    <td style={valueCellRed}>{currentQuantity} units</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Reorder Level:</td>
                    <td style={valueCell}>{reorderLevel} units</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section style={ctaSection}>
              <Button style={button} href={stockInUrl}>
                Restock Now →
              </Button>
            </Section>

            <Text style={actionLinkText}>
              Or copy this link into your browser: <br />
              <Link href={stockInUrl} style={linkStyle}>
                {stockInUrl}
              </Link>
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Sent by SmartKiosk for {shopName}
            </Text>
            <Text style={footerSubtext}>
              Please do not reply directly to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Inline Styles ────────────────────────────────────────────────────────────
const main = {
  backgroundColor: '#f8f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '580px',
};

const headerSection = {
  textAlign: 'center' as const,
  padding: '10px 0',
};

const logoText = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 4px',
  letterSpacing: '-0.025em',
};

const shopNameText = {
  fontSize: '14px',
  color: '#64748b',
  margin: '0',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '20px 0',
};

const alertBanner = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fee2e2',
  borderRadius: '8px',
  padding: '16px',
  textAlign: 'center' as const,
};

const bannerHeading = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#dc2626',
  margin: '0',
};

const contentSection = {
  padding: '10px 0',
};

const introText = {
  fontSize: '16px',
  color: '#334155',
  lineHeight: '1.5',
  margin: '0 0 20px',
};

const productCard = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '20px',
  margin: '0 0 24px',
};

const productTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 10px',
};

const cardHr = {
  borderColor: '#f1f5f9',
  margin: '10px 0',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const labelCell = {
  fontSize: '14px',
  color: '#64748b',
  padding: '6px 0',
  width: '130px',
};

const valueCell = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: '#0f172a',
  padding: '6px 0',
};

const valueCellRed = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: '#dc2626',
  padding: '6px 0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  backgroundColor: '#dc2626',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const actionLinkText = {
  fontSize: '12px',
  color: '#94a3b8',
  textAlign: 'center' as const,
  lineHeight: '1.4',
  margin: '24px 0 0',
};

const linkStyle = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const footerSection = {
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '14px',
  color: '#64748b',
  margin: '0 0 4px',
};

const footerSubtext = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '0',
};
