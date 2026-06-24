import { NextRequest, NextResponse } from 'next/server';
import { getInviteContext } from '@/lib/assessment-data';
import { sameCandidateName, validateGptActionKey } from '@/lib/gpt-action-auth';
import { calculateCheckpointScore, combineCallAndTicketScore, getFirstCallsReadiness, scoreTicket } from '@/lib/assessment-scoring';
import { createServerClient } from '@/lib/supabase';

type Line = { speaker?: unknown; text?: unknown };
export async function POST(request: NextRequest,{params}:{params:Promise<{token:string}>}){
  if(!await validateGptActionKey(request.headers.get('x-api-key')))return NextResponse.json({error:'Invalid API key'},{status:401});
  const{token}=await params;const body=await request.json();const context=await getInviteContext(token);
  if('error'in context)return NextResponse.json({error:context.error==='expired'?'Assessment code expired':'Assessment code not found'},{status:context.error==='expired'?410:404});
  const candidate=Array.isArray(context.pack.candidates)?context.pack.candidates[0]:context.pack.candidates;
  if(!candidate||!sameCandidateName(candidate.name,String(body.candidate_name||'')))return NextResponse.json({error:'Name does not match this assessment code'},{status:403});
  const lines=(Array.isArray(body.transcript)?body.transcript:[]).filter((line:Line)=>['candidate','caller'].includes(String(line.speaker))&&typeof line.text==='string'&&line.text.trim()).slice(0,100);
  const transcriptText=lines.map((line:Line)=>`${line.speaker==='candidate'?'Candidate':'Caller'}: ${String(line.text).trim()}`).join('\n');
  const ticket=String(body.candidate_ticket_text||'').trim();const results=body.checkpoint_results;
  if(lines.length<6||transcriptText.length<120)return NextResponse.json({error:'Transcript is too short to evaluate'},{status:400});
  if(ticket.length<30)return NextResponse.json({error:'A useful ticket is required'},{status:400});
  const supabase=createServerClient();const{data:session}=await supabase.from('sessions').select('id,transcript_text,candidate_ticket_text,scenarios(required_checkpoints)').eq('id',String(body.session_id||'')).eq('assessment_pack_id',context.pack.id).eq('tenant_id',context.pack.tenant_id).single();
  if(!session)return NextResponse.json({error:'Session not found'},{status:404});if(session.transcript_text||session.candidate_ticket_text)return NextResponse.json({error:'Call has already been submitted'},{status:409});
  const scenario=Array.isArray(session.scenarios)?session.scenarios[0]:session.scenarios;const required=(scenario?.required_checkpoints??{})as Record<string,boolean>;const keys=Object.keys(required).filter((key)=>required[key]);
  if(!results||typeof results!=='object'||keys.some((key)=>typeof results[key]?.passed!=='boolean'||typeof results[key]?.evidence!=='string'))return NextResponse.json({error:'Checkpoint evidence is incomplete or malformed'},{status:400});
  const call=calculateCheckpointScore(required,results);const ticketScore=scoreTicket(ticket,transcriptText);const critical=call.criticalMisses.concat(ticketScore.score<40?['usable_ticket']:[]);const finalScore=combineCallAndTicketScore(call.score,ticketScore.score);const label=getFirstCallsReadiness(finalScore,critical);
  const{error}=await supabase.from('sessions').update({transcript_json:lines,transcript_text:transcriptText,conversation_transcript:transcriptText,candidate_ticket_text:ticket,checkpoints:results,rubric_evidence:results,score:call.score,score_breakdown:{call_score:call.score,missed:call.missed,critical_misses:critical},ticket_assessed:true,ticket_score:ticketScore,readiness_score:finalScore,readiness_label:label,feedback_text:String(body.feedback_summary||'').slice(0,4000)}).eq('id',session.id).eq('assessment_pack_id',context.pack.id);
  if(error)return NextResponse.json({error:'Unable to save call'},{status:500});
  const{count}=await supabase.from('sessions').select('id',{count:'exact',head:true}).eq('assessment_pack_id',context.pack.id).not('candidate_ticket_text','is',null);const complete=(count??0)>=3;
  if(complete){const{data:sessions}=await supabase.from('sessions').select('readiness_score,score_breakdown').eq('assessment_pack_id',context.pack.id);const average=Math.round((sessions??[]).reduce((sum,item)=>sum+(item.readiness_score??0),0)/Math.max(1,sessions?.length??0));const misses=(sessions??[]).flatMap((item)=>((item.score_breakdown as{critical_misses?:string[]}|null)?.critical_misses??[]));await supabase.from('assessment_packs').update({status:'completed',completed_at:new Date().toISOString(),final_recommendation:getFirstCallsReadiness(average,misses)}).eq('id',context.pack.id).eq('tenant_id',context.pack.tenant_id);}
  return NextResponse.json({saved:true,call_number:count??0,complete,next_step:complete?'assessment_complete':'start_next_call'});
}
