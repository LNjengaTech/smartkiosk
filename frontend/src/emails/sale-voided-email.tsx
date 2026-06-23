// src/emails/sale-voided-email.tsx
// Purpose: React Email template for voided sales alerts.

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

interface SaleVoidedItem {
  name: string;
  quantity: number;
  total: number;
}

interface SaleVoidedEmailProps {
  shopName: string;
  receiptNumber: string;
  totalAmount: number;
  voidedBy: string;
  voidedAt: string;
  items: SaleVoidedItem[];
  dashboardUrl: string;
}

export default function SaleVoidedEmail({
  shopName = 'My Shop',
  receiptNumber = 'REC-100452',
  totalAmount = 2500,
  voidedBy = 'Alice Cashier',
  voidedAt = '2026-06-23T14:35:00Z',
  items = [
    { name: 'Soap Bar 200g', quantity: 2, total: 300 },
    { name: 'Basmati Rice 5kg', quantity: 1, total: 1100 },
    { name: 'Cooking Oil 2L', quantity: 1, total: 1100 },
  ],
  dashboardUrl = 'http://localhost:3000/dashboard/sales',
}: SaleVoidedEmailProps) {
  const formattedDate = new Date(voidedAt).toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <Html>
      <Head />
      <Preview>{`🚫 Sale Voided: ${receiptNumber} (KES ${totalAmount}) — ${shopName}`}</Preview>
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
            <Heading style={bannerHeading}>🚫 Transaction Voided</Heading>
          </Section>

          {/* Body */}
          <Section style={contentSection}>
            <Text style={introText}>
              A completed sale has been voided. Here are the details of the transaction:
            </Text>

            {/* Sale details card */}
            <Section style={detailsCard}>
              <table style={tableStyle}>
                <tbody>
                  <tr>
                    <td style={labelCell}>Receipt Number:</td>
                    <td style={valueCellBold}>{receiptNumber}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Voided By:</td>
                    <td style={valueCell}>{voidedBy}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Voided At:</td>
                    <td style={valueCell}>{formattedDate} (EAT)</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Total Amount:</td>
                    <td style={valueCellRed}>KES {totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Items list heading */}
            <Text style={itemsHeading}>Voided Items</Text>

            {/* Items table */}
            <Section style={itemsCard}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderRow}>
                    <th style={tableHeaderLeft}>Item</th>
                    <th style={tableHeaderRight}>Qty</th>
                    <th style={tableHeaderRight}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={idx % 2 === 0 ? tableRowEven : tableRowOdd}>
                      <td style={tableCellLeft}>{item.name}</td>
                      <td style={tableCellRight}>{item.quantity}</td>
                      <td style={tableCellRight}>KES {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section style={ctaSection}>
              <Button style={button} href={dashboardUrl}>
                Review Sales History →
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
              This is a security alert. Please verify this action with your staff.
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

const detailsCard = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px',
  margin: '0 0 24px',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const labelCell = {
  fontSize: '14px',
  color: '#64748b',
  padding: '6px 0',
  width: '140px',
};

const valueCell = {
  fontSize: '14px',
  color: '#0f172a',
  padding: '6px 0',
};

const valueCellBold = {
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

const itemsHeading = {
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 10px',
};

const itemsCard = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  overflow: 'hidden',
  margin: '0 0 24px',
};

const tableHeaderRow = {
  backgroundColor: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
};

const tableHeaderLeft = {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#475569',
  textAlign: 'left' as const,
  padding: '10px 16px',
};

const tableHeaderRight = {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#475569',
  textAlign: 'right' as const,
  padding: '10px 16px',
};

const tableRowEven = {
  backgroundColor: '#ffffff',
  borderBottom: '1px solid #f1f5f9',
};

const tableRowOdd = {
  backgroundColor: '#f8fafc',
  borderBottom: '1px solid #f1f5f9',
};

const tableCellLeft = {
  fontSize: '13px',
  color: '#334155',
  padding: '10px 16px',
  textAlign: 'left' as const,
};

const tableCellRight = {
  fontSize: '13px',
  color: '#334155',
  padding: '10px 16px',
  textAlign: 'right' as const,
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '28px 0 16px',
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
