import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { NewAssessmentForm } from '@/components/assessments/NewAssessmentForm';

export default async function NewAssessmentPage(){await requireAdmin();return <div className="mx-auto max-w-7xl px-6 py-10"><Link href="/dashboard/admin/assessments" className="text-sm text-zinc-400 hover:text-white">← Assessments</Link><h1 className="mt-5 text-3xl font-semibold text-white">Create assessment</h1><p className="mb-8 mt-2 text-zinc-400">Create a candidate record and a private assessment link.</p><NewAssessmentForm/></div>}
