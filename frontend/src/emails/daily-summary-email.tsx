// src/emails/daily-summary-email.tsx
// Purpose: React Email template for the daily store performance summary.

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

interface DailySummaryEmailProps {
  shopName: string;
  ownerName: string;
  date: string;
  todayRevenue: number;
  todayOrders: number;
  todayProfit: number;
  topProduct: { name: string; revenue: number } | null;
  lowStockCount: number;
  dashboardUrl: string;
}

export default function DailySummaryEmail({
  shopName = 'My Shop',
  ownerName = 'Merchant',
  date = '2026-06-23',
  todayRevenue = 15000,
  todayOrders = 45,
  todayProfit = 3500,
  topProduct = { name: 'Cooking Oil 1L', revenue: 4500 },
  lowStockCount = 3,
  dashboardUrl = 'http://localhost:3000/dashboard',
}: DailySummaryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`📊 Daily summary: ${shopName} — ${date}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Text style={logoText}>SmartKiosk</Text>
            <Text style={shopNameText}>{shopName}</Text>
          </Section>

          <Hr style={hr} />

          {/* Heading */}
          <Section style={titleSection}>
            <Heading style={titleHeading}>Daily Summary for {date}</Heading>
            <Text style={welcomeText}>Hello {ownerName}, here is how your business performed today:</Text>
          </Section>

          {/* Metric Cards Table */}
          <Section style={metricsSection}>
            <table style={metricsTable}>
              <tbody>
                <tr>
                  <td style={metricCardCell}>
                    <div style={metricCard}>
                      <Text style={metricLabel}>REVENUE</Text>
                      <Text style={metricValue}>KES {todayRevenue.toLocaleString()}</Text>
                    </div>
                  </td>
                  <td style={metricCardCell}>
                    <div style={metricCard}>
                      <Text style={metricLabel}>ORDERS</Text>
                      <Text style={metricValue}>{todayOrders}</Text>
                    </div>
                  </td>
                  <td style={metricCardCell}>
                    <div style={metricCard}>
                      <Text style={metricLabel}>PROFIT</Text>
                      <Text style={metricValueGreen}>KES {todayProfit.toLocaleString()}</Text>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Best Seller Section */}
          {topProduct && (
            <Section style={highlightCard}>
              <Text style={highlightTitle}>⭐ Best Seller Today</Text>
              <Text style={highlightContent}>
                <strong>{topProduct.name}</strong> contributed <strong>KES {topProduct.revenue.toLocaleString()}</strong> in sales today.
              </Text>
            </Section>
          )}

          {/* Low Stock Warning Section */}
          {lowStockCount > 0 && (
            <Section style={warningCard}>
              <Text style={warningTitle}>⚠️ Stock Alerts</Text>
              <Text style={warningContent}>
                You have <strong>{lowStockCount}</strong> product(s) at or below their reorder level. Restock them soon to prevent stockouts.
              </Text>
            </Section>
          )}

          {/* CTA Section */}
          <Section style={ctaSection}>
            <Button style={button} href={dashboardUrl}>
              View Full Report →
            </Button>
          </Section>

          <Text style={actionLinkText}>
            Or copy this link: <br />
            <Link href={dashboardUrl} style={linkStyle}>
              {dashboardUrl}
            </Link>
          </Text>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Keep it up, {ownerName}! 🚀
            </Text>
            <Text style={footerSubtext}>
              Sent by SmartKiosk for {shopName}
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

const titleSection = {
  padding: '10px 0',
  textAlign: 'center' as const,
};

const titleHeading = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 10px',
};

const welcomeText = {
  fontSize: '16px',
  color: '#475569',
  margin: '0',
};

const metricsSection = {
  margin: '24px 0',
};

const metricsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  tableLayout: 'fixed' as const,
};

const metricCardCell = {
  padding: '0 6px',
  width: '33.33%',
};

const metricCard = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px',
  textAlign: 'center' as const,
};

const metricLabel = {
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#64748b',
  margin: '0 0 6px',
  letterSpacing: '0.05em',
};

const metricValue = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0',
};

const metricValueGreen = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#16a34a',
  margin: '0',
};

const highlightCard = {
  backgroundColor: '#eff6ff',
  border: '1px solid #dbeafe',
  borderRadius: '8px',
  padding: '16px',
  margin: '0 0 16px',
};

const highlightTitle = {
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#1e40af',
  margin: '0 0 6px',
};

const highlightContent = {
  fontSize: '14px',
  color: '#1e3a8a',
  margin: '0',
};

const warningCard = {
  backgroundColor: '#fffbeb',
  border: '1px solid #fef3c7',
  borderRadius: '8px',
  padding: '16px',
  margin: '0 0 16px',
};

const warningTitle = {
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#92400e',
  margin: '0 0 6px',
};

const warningContent = {
  fontSize: '14px',
  color: '#78350f',
  margin: '0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '28px 0 16px',
};

const button = {
  backgroundColor: '#2563eb',
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
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 4px',
};

const footerSubtext = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '0',
};
