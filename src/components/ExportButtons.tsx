import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BusinessResult } from '../types';

interface ExportButtonsProps {
    data: BusinessResult[];
}

function toCsvValue(value: unknown): string {
    const s = (value ?? '').toString();
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

export function ExportButtons({ data }: ExportButtonsProps) {
    function handleExportCsv() {
        const headers = ['Name', 'Phone', 'Address', 'Website', 'Latitude', 'Longitude'];
        const rows = data.map((d) => [
            toCsvValue(d.name),
            toCsvValue(d.phone || ''),
            toCsvValue(d.address),
            toCsvValue(d.website || ''),
            toCsvValue(d.location.lat),
            toCsvValue(d.location.lng),
        ]);
        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'client-finder-results.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleExportPdf() {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text('Client Finder Results', 14, 14);
        autoTable(doc, {
            head: [['Name', 'Phone', 'Address', 'Website']],
            body: data.map((d) => [
                d.name,
                d.phone || '',
                d.address,
                d.website ? new URL(d.website).hostname : '—',
            ]),
            styles: { fontSize: 8 },
            startY: 20,
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 35 },
                2: { cellWidth: 120 },
                3: { cellWidth: 60 },
            },
        });
        doc.save('client-finder-results.pdf');
    }

    return (
        <div className="export-buttons">
            <button className="ghost" onClick={handleExportCsv} disabled={data.length === 0}>
                Export CSV
            </button>
            <button className="ghost" onClick={handleExportPdf} disabled={data.length === 0}>
                Export PDF
            </button>
        </div>
    );
}


