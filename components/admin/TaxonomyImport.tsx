'use client';

import { useState } from 'react';

export function TaxonomyImport() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    const formData = new FormData();
    formData.set('file', file);

    const res = await fetch('/api/admin/taxonomy/import', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setMessage(`Imported ${data.inserted} rows.`);
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || 'Import failed.');
    }

    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-2">Import taxonomy</h3>
      <p className="text-zinc-500 text-xs mb-3">
        Upload Excel/CSV. Existing taxonomy will be replaced.
      </p>
      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm cursor-pointer">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onChange}
          disabled={uploading}
          className="sr-only"
        />
        {uploading ? 'Uploading...' : 'Upload file'}
      </label>
      {message && <p className="text-xs text-zinc-400 mt-2">{message}</p>}
    </div>
  );
}
