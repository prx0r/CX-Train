import { CandidateAssessment } from '@/components/assessments/CandidateAssessment';
export default async function CandidatePage({params}:{params:Promise<{token:string}>}){const{token}=await params;return <div className="min-h-screen bg-zinc-950"><CandidateAssessment token={token}/></div>}
