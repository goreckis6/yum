import { getApiBaseUrl } from '../config/api';
import { ReceiptCategory, ReceiptItem } from '../types';

export interface ExtractedReceipt {
  merchant: string;
  date: string;
  total: number;
  subtotal: number;
  tax: number;
  currency: string;
  category: ReceiptCategory;
  paymentMethod?: string;
  items: ReceiptItem[];
}

export async function extractReceiptFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<{ receipt: ExtractedReceipt; demo: boolean }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/extract-receipt-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }

  return res.json();
}

export interface ExportFile {
  filename: string;
  mimeType: string;
  base64: string;
}

export async function exportReceipts(
  receipts: unknown[],
  format: 'csv' | 'pdf',
  includePhotos = false,
): Promise<ExportFile> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/receipts/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipts, format, includePhotos }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }

  return res.json();
}
