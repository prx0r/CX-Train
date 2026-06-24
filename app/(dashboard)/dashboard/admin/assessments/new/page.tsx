import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { NewAssessmentForm } from '@/components/assessments/NewAssessmentForm';

export default async function NewAssessmentPage(){await requireAdmin();return <div className="mx-auto max-w-7xl px-6 py-10"><Link href="/dashboard/admin/assessments" className="text-sm text-zinc-400 hover:text-white">← Assessments</Link><h1 className="mt-5 text-3xl font-semibold text-white">Create First Calls assessment</h1><p className="mb-8 mt-2 text-zinc-400">Enter the candidate and generate a private three-call assessment link.</p><NewAssessmentForm/></div>}
