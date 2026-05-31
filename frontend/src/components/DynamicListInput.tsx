import React from 'react';
import { Plus, X } from 'lucide-react';

export interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'number';
}

interface DynamicListInputProps {
  items: Record<string, string>[];
  onChange: (items: Record<string, string>[]) => void;
  fields: FieldDef[];
  addLabel: string;
}

export const DynamicListInput: React.FC<DynamicListInputProps> = ({ items, onChange, fields, addLabel }) => {
  const handleAdd = () => {
    const newItem: Record<string, string> = {};
    fields.forEach((f) => {
      newItem[f.key] = '';
    });
    onChange([...items, newItem]);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, key: string, value: string) => {
    const updated = items.map((item, i) => {
      if (i === index) {
        return { ...item, [key]: value };
      }
      return item;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex flex-1 gap-2">
            {fields.map((field) => (
              <div key={field.key} className="flex-1">
                {index === 0 && (
                  <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
                )}
                <input
                  type={field.type || 'text'}
                  value={item[field.key] || ''}
                  onChange={(e) => handleChange(index, field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleRemove(index)}
            className="mt-[1px] flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-500 transition-colors hover:border-red-800 hover:bg-red-900/20 hover:text-red-400"
            aria-label="Remove row"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
};