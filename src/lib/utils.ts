import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Transaction } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'AU$',
  NGN: '₦',
  GHS: '₵',
};

export function formatCurrency(amount: number, currencyCode: string = 'USD') {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || '$';
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function exportToCSV(transactions: Transaction[], fileName: string = 'transactions.csv', currency: string = 'USD') {
  if (transactions.length === 0) return;

  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'AI Categorized'];
  const rows = transactions.map(t => [
    t.date,
    t.description.replace(/,/g, ''), // Remove commas to avoid CSV breakage
    t.category,
    t.type,
    formatCurrency(t.amount, currency).replace(/,/g, ''),
    t.isAiCategorized ? 'Yes' : 'No'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(transactions: Transaction[], fileName: string = 'transactions.pdf', currency: string = 'USD') {
  if (transactions.length === 0) return;

  const doc = new jsPDF();
  doc.text('Transactions Report', 14, 15);

  const tableColumn = ['Date', 'Description', 'Category', 'Type', 'Amount', 'AI Categorized'];
  const tableRows = transactions.map(t => [
    t.date,
    t.description,
    t.category,
    t.type,
    formatCurrency(t.amount, currency),
    t.isAiCategorized ? 'Yes' : 'No'
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 20,
  });

  doc.save(fileName);
}

export async function exportToWord(transactions: Transaction[], fileName: string = 'transactions.docx', currency: string = 'USD') {
  if (transactions.length === 0) return;

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: ['Date', 'Description', 'Category', 'Type', 'Amount', 'AI Categorized'].map(header => 
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })] })
        ),
      }),
      ...transactions.map(t => 
        new TableRow({
          children: [
            t.date,
            t.description,
            t.category,
            t.type,
            formatCurrency(t.amount, currency),
            t.isAiCategorized ? 'Yes' : 'No'
          ].map(text => new TableCell({ children: [new Paragraph(text)] }))
        })
      )
    ]
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ children: [new TextRun({ text: 'Transactions Report', bold: true, size: 32 })] }),
        new Paragraph({ text: '' }),
        table
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}
