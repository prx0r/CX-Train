'use client';

import { useState, useEffect } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';
import DashboardCard from '@/components/mvp/DashboardCard';

interface Assessment {
  id: string;
  title: string;
  candidate_name: string;
  candidate_email: string | null;
  invite_token: string;
  status: string;
  created_at: string;
}

export default function MvpDashboard() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState('');

  async function loadAssessments() {
    try {
      const res = await fetch('/api/mvp/assessments');
      const data = await res.json();
      if (data.assessments) setAssessments(data.assessments);
    } catch (e) {
      console.error('Failed to load assessments', e);
    }
  }

  useEffect(() => { loadAssessments(); }, []);

  async function createAssessment() {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    setInviteUrl('');
    try {
      const res = await fetch('/api/mvp/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_name: name, candidate_email: email || null }),
      });
      const data = await res.json();
      if (data.invite_url) {
        setInviteUrl(data.invite_url);
        setName('');
        setEmail('');
        await loadAssessments();
      } else {
        setError(data.error || 'Failed to create');
      }
    } catch (e) {
      setError('Failed to create assessment');
    }
    setCreating(false);
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => alert('Link copied!')).catch(() => prompt('Copy this link:', url));
  }

  const statusColors: Record<string, string> = {
    draft: 'text-yellow-400', invited: 'text-blue-400', in_progress: 'text-cyan-400',
    completed: 'text-green-400', analysed: 'text-emerald-300', reviewed: 'text-purple-400',
  };

  const total = assessments.length;
  const completed = assessments.filter(a => ['completed', 'analysed', 'reviewed'].includes(a.status)).length;
  const awaiting = assessments.filter(a => a.status === 'completed').length;

  return (
    <ManagerShell>
      {/* Welcome header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-gray-400">CallCallum Demo MSP &middot; Manager Dashboard</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <DashboardCard label="Total Assessments" value={total} color="blue" />
        <DashboardCard label="Completed" value={completed} color="green" />
        <DashboardCard label="Awaiting Analysis" value={awaiting} color="yellow" />
        <DashboardCard label="Assist (today)" value="—" color="gray" disabled />
        <DashboardCard label="Knowledge Candidates" value="—" color="gray" disabled />
        <DashboardCard label="People Needing Practice" value="—" color="gray" disabled />
      </div>

      {/* Create assessment form */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Create Assessment</h2>
        <div className="flex flex-wrap gap-3">
          <input
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
            placeholder="Candidate name *"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
            placeholder="Candidate email (optional)"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={createAssessment}
            disabled={creating || !name.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {inviteUrl && (
          <p className="text-green-400 text-sm mt-2">
            Created! Invite link: <a href={inviteUrl} className="underline">{inviteUrl}</a>
          </p>
        )}
      </div>

      {/* Recent assessments */}
      <div className="bg-gray-900 border border-gray-800 rounded overflow-x-auto mb-6">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Recent Assessments</h2>
          <a href="/mvp/assessments" className="text-xs text-blue-400 hover:underline">View all</a>
        </div>
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
            {assessments.length === 0 && (
              <tr><td colSpan={5} className="p-3 text-gray-500 text-center">No assessments yet. Create one above!</td></tr>
            )}
            {assessments.slice(0, 10).map(a => (
              <tr key={a.id} className="border-b border-gray-800">
                <td className="p-3">
                  <div className="font-medium">{a.candidate_name}</div>
                  {a.candidate_email && <div className="text-gray-500 text-xs">{a.candidate_email}</div>}
                </td>
                <td className={`p-3 ${statusColors[a.status] || 'text-gray-400'}`}>{a.status}</td>
                <td className="p-3 text-gray-400">{new Date(a.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <button
                    className="text-blue-400 hover:text-blue-300 text-xs underline"
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

      {/* Product map */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Product Map</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="bg-blue-950/20 border border-blue-900/40 rounded p-3">
            <span className="text-blue-300 font-medium">Assess</span>
            <p className="text-gray-500 text-xs mt-1">Simulated calls with AI callers, scored against manager-defined standards.</p>
          </div>
          <div className="bg-yellow-950/20 border border-yellow-900/40 rounded p-3">
            <span className="text-yellow-300 font-medium">Standards</span>
            <p className="text-gray-500 text-xs mt-1">Manager-defined MSP requirements: checkpoints, rubrics, readiness thresholds.</p>
          </div>
          <div className="bg-green-950/20 border border-green-900/40 rounded p-3">
            <span className="text-green-300 font-medium">Assist</span>
            <p className="text-gray-500 text-xs mt-1">AI ticket/customer response assistant for live or simulated situations.</p>
          </div>
          <div className="bg-purple-950/20 border border-purple-900/40 rounded p-3">
            <span className="text-purple-300 font-medium">Knowledge</span>
            <p className="text-gray-500 text-xs mt-1">Capture resolved interactions into reusable procedures and KB articles.</p>
          </div>
          <div className="bg-pink-950/20 border border-pink-900/40 rounded p-3">
            <span className="text-pink-300 font-medium">People</span>
            <p className="text-gray-500 text-xs mt-1">Scorecards, readiness levels, and growth tracking for each technician.</p>
          </div>
          <div className="bg-gray-800 border border-gray-700/40 rounded p-3 opacity-60">
            <span className="text-gray-400 font-medium">Clients</span>
            <p className="text-gray-600 text-xs mt-1">Client profiles, environment details, and issue history.</p>
          </div>
        </div>
      </div>
    </ManagerShell>
  );
}
