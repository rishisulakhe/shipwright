import React from 'react';

interface InfoTableProps {
  title?: string;
  rows: { label: string; value: React.ReactNode; mono?: boolean }[];
}

export default function InfoTable({ title, rows }: InfoTableProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      {title && <h2 className="mb-3 text-sm font-medium text-zinc-400">{title}</h2>}
      <div className="space-y-2 text-sm">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-zinc-500">{row.label}</span>
            <span className={row.mono ? 'font-mono text-zinc-300' : 'text-zinc-300'}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}