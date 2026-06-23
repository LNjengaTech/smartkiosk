// src/app/api/emails/render/route.ts
// Purpose: Server-side API route that renders React Email templates to HTML strings.
//          Protected with an internal shared secret token.

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { render } from '@react-email/render';

import LowStockEmail from '@/emails/low-stock-email';
import DailySummaryEmail from '@/emails/daily-summary-email';
import ExpiryAlertEmail from '@/emails/expiry-alert-email';
import SaleVoidedEmail from '@/emails/sale-voided-email';

const TEMPLATE_MAP = {
  'low-stock': LowStockEmail,
  'daily-summary': DailySummaryEmail,
  'expiry-alert': ExpiryAlertEmail,
  'sale-voided': SaleVoidedEmail,
} as const;

type TemplateName = keyof typeof TEMPLATE_MAP;

export async function POST(req: NextRequest) {
  try {
    // 1. Validate the Authorization header
    const authHeader = req.headers.get('authorization');
    const secret = process.env.EMAIL_RENDER_SECRET;

    if (!secret) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error: render secret missing.' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized access.' },
        { status: 401 }
      );
    }

    // 2. Parse and validate body
    const body = await req.json();
    const { template, data } = body as { template: string; data: Record<string, any> };

    if (!template || !(template in TEMPLATE_MAP)) {
      return NextResponse.json(
        { success: false, message: `Invalid template name. Allowed: ${Object.keys(TEMPLATE_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    // 3. Render template to HTML string
    const Component = TEMPLATE_MAP[template as TemplateName];
    // @ts-ignore
    const html = await render(React.createElement(Component, data));

    return NextResponse.json({ success: true, html });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown rendering error';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
