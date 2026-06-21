// frontend/src/components/reports/export-button.tsx
// Purpose: Trigger Bearer-authenticated CSV export download or PDF printing.

'use client';

import * as React from 'react';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api/client';
import { getErrorMessage } from '@/lib/utils';

interface ExportButtonProps {
  type: 'sales' | 'stock' | 'expenses' | 'profit' | 'attendants';
  from?: string;
  to?: string;
  printRef?: React.RefObject<HTMLDivElement>;
}

export function ExportButton({ type, from, to, printRef }: ExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  // Trigger PDF print if ref is supplied
  const handlePrint = useReactToPrint({
    contentRef: printRef || undefined,
    documentTitle: `smartkiosk-${type}-report`,
  });

  const handleCsvExport = async () => {
    // Only sales, stock, and expenses support CSV streams on the server
    if (type !== 'sales' && type !== 'stock' && type !== 'expenses') {
      toast.error(`CSV export is not supported for ${type} reports.`);
      return;
    }

    try {
      setIsExporting(true);
      const fromQuery = from ? `&from=${from}` : '';
      const toQuery = to ? `&to=${to}` : '';

      const response = await apiClient.get(
        `/reports/export?type=${type}${fromQuery}${toQuery}&format=csv`,
        {
          responseType: 'blob',
        }
      );

      // Create download link for the blob
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `smartkiosk-${type}-${from || 'all'}-to-${to || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('CSV report exported successfully');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to export CSV report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {printRef && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePrint()}
          className="h-9 gap-1.5"
        >
          <Printer className="h-4 w-4" />
          Print PDF
        </Button>
      )}

      {(type === 'sales' || type === 'stock' || type === 'expenses') && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCsvExport}
          disabled={isExporting}
          className="h-9 gap-1.5"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      )}
    </div>
  );
}
