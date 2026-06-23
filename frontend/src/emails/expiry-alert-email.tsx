// src/emails/expiry-alert-email.tsx
// Purpose: React Email template for products expiring soon.

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

interface ProductExpiryItem {
  name: string;
  expiryDate: string;
  daysRemaining: number;
  quantity: number;
}

interface ExpiryAlertEmailProps {
  shopName: string;
  products: ProductExpiryItem[];
  dashboardUrl: string;
}

export default function ExpiryAlertEmail({
  shopName = 'My Shop',
  products = [
    { name: 'Yogurt Strawberry 250ml', expiryDate: '2026-06-25', daysRemaining: 2, quantity: 12 },
    { name: 'Fresh Milk 1L', expiryDate: '2026-06-28', daysRemaining: 5, quantity: 8 },
  ],
  dashboardUrl = 'http://localhost:3000/dashboard/inventory',
}: ExpiryAlertEmailProps) {
  const sortedProducts = [...products].sort((a, b) => a.daysRemaining - b.daysRemaining);

  return (
    <Html>
      <Head />
      <Preview>{`⏳ Expiry Alert: ${products.length} product(s) expiring soon — ${shopName}`}</Preview>
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
            <Heading style={bannerHeading}>⚠️ Products Expiring Soon</Heading>
          </Section>

          {/* Body */}
          <Section style={contentSection}>
            <Text style={introText}>
              The following products in your inventory will expire within the next 7 days. Please review and manage these items:
            </Text>

            {/* Product List */}
            {sortedProducts.map((product, idx) => (
              <Section key={idx} style={productCard}>
                <table style={tableStyle}>
                  <tbody>
                    <tr>
                      <td style={productTitleCell} colSpan={2}>
                        <Text style={productTitle}>{product.name}</Text>
                      </td>
                    </tr>
                    <tr>
                      <td style={labelCell}>Expiry Date:</td>
                      <td style={valueCell}>{product.expiryDate}</td>
                    </tr>
                    <tr>
                      <td style={labelCell}>Remaining Time:</td>
                      <td style={product.daysRemaining <= 3 ? valueCellRedBold : valueCellAmberBold}>
                        {product.daysRemaining} day(s) left
                      </td>
                    </tr>
                    <tr>
                      <td style={labelCell}>Current Quantity:</td>
                      <td style={valueCell}>{product.quantity} units</td>
                    </tr>
                  </tbody>
                </table>
              </Section>
            ))}

            <Section style={ctaSection}>
              <Button style={button} href={dashboardUrl}>
                Manage Inventory →
              </Button>
            </Section>

            <Text style={actionLinkText}>
              Or copy this link: <br />
              <Link href={dashboardUrl} style={linkStyle}>
                {dashboardUrl}
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
  backgroundColor: '#fffbeb',
  border: '1px solid #fef3c7',
  borderRadius: '8px',
  padding: '16px',
  textAlign: 'center' as const,
};

const bannerHeading = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#d97706',
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
  padding: '16px',
  margin: '0 0 16px',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const productTitleCell = {
  paddingBottom: '8px',
};

const productTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0',
};

const labelCell = {
  fontSize: '13px',
  color: '#64748b',
  padding: '4px 0',
  width: '140px',
};

const valueCell = {
  fontSize: '13px',
  color: '#0f172a',
  padding: '4px 0',
};

const valueCellRedBold = {
  fontSize: '13px',
  fontWeight: 'bold' as const,
  color: '#dc2626',
  padding: '4px 0',
};

const valueCellAmberBold = {
  fontSize: '13px',
  fontWeight: 'bold' as const,
  color: '#d97706',
  padding: '4px 0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '28px 0 16px',
};

const button = {
  backgroundColor: '#d97706',
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
  margin: '0 0 24px',
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
