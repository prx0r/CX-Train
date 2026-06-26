'use client';

import { useState, useEffect } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';

interface Assessment {
  id: string;
  title: string;
  candidate_name: string;
  candidate_email: string | null;
  invite_token: string;
  status: string;
  created_at: string;
}

export default function AssessmentsIndexPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/mvp/assessments')
      .then(r => r.json())
      .then(data => {
        if (data.assessments) setAssessments(data.assessments);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => alert('Link copied!')).catch(() => prompt('Copy this link:', url));
  }

  const statusColors: Record<string, string> = {
    draft: 'text-yellow-400', invited: 'text-cyan-400', in_progress: 'text-cyan-400',
    completed: 'text-green-400', analysed: 'text-emerald-300', reviewed: 'text-purple-400',
  };

  return (
    <ManagerShell>
      <h1 className="text-2xl font-bold mb-2">Assessments</h1>
      <p className="text-sm text-gray-400 mb-6">All candidate assessment sessions.</p>

      <div className="bg-gray-900 border border-gray-800 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">Candidate</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3">Link</th>
              <th className="text-left p-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="p-3 text-gray-500 text-center">Loading...</td></tr>
            )}
            {!loading && assessments.length === 0 && (
              <tr><td colSpan={5} className="p-3 text-gray-500 text-center">No assessments yet</td></tr>
            )}
            {assessments.map(a => (
              <tr key={a.id} className="border-b border-gray-800">
                <td className="p-3">
                  <div className="font-medium">{a.candidate_name}</div>
                  {a.candidate_email && <div className="text-gray-500 text-xs">{a.candidate_email}</div>}
                </td>
                <td className={`p-3 ${statusColors[a.status] || 'text-gray-400'}`}>{a.status}</td>
                <td className="p-3 text-gray-400">{new Date(a.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <button
                    className="text-cyan-400 hover:text-cyan-300 text-xs underline"
                    onClick={() => copyLink(`${window.location.origin}/mvp/assessment/${a.invite_token}`)}
                  >
                    Copy link
                  </button>
                </td>
                <td className="p-3">
                  <a href={`/mvp/assessments/${a.id}`} className="text-cyan-400 hover:text-cyan-300 text-xs underline">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ManagerShell>
  );
}
