import { NextRequest, NextResponse } from 'next/server';
import { getInviteContext } from '@/lib/assessment-data';
import { sameCandidateName, validateGptActionKey } from '@/lib/gpt-action-auth';
import { calculateCheckpointScore, combineCallAndTicketScore, getFirstCallsReadiness, scoreTicket } from '@/lib/assessment-scoring';
import { createServerClient } from '@/lib/supabase';
import { evaluateTranscript } from '@/lib/evaluation/evaluator';
import { calculateWeightedScore, scoreTicketWithPatterns } from '@/lib/evaluation/scoring';
import { getRubric } from '@/lib/evaluation/scenarios';

type Line = { speaker?: unknown; text?: unknown };

export async function POST(request: NextRequest,{params}:{params:Promise<{token:string}>}){
  if(!await validateGptActionKey(request.headers.get('x-api-key')))return NextResponse.json({error:'Invalid API key'},{status:401});
  const{token}=await params;const body=await request.json();const context=await getInviteContext(token);
  if('error'in context)return NextResponse.json({error:context.error==='expired'?'Assessment code expired':'Assessment code not found'},{status:context.error==='expired'?410:404});
  const candidate=Array.isArray(context.pack.candidates)?context.pack.candidates[0]:context.pack.candidates;
  if(!candidate||!sameCandidateName(candidate.name,String(body.candidate_name||'')))return NextResponse.json({error:'Name does not match this assessment code'},{status:403});

  const lines=(Array.isArray(body.transcript)?body.transcript:[]).filter((line:Line)=>['candidate','caller'].includes(String(line.speaker))&&typeof line.text==='string'&&line.text.trim()).slice(0,100);
  const transcriptText=lines.map((line:Line)=>`${line.speaker==='candidate'?'Candidate':'Caller'}: ${String(line.text).trim()}`).join('\n');
  const ticket=String(body.candidate_ticket_text||'').trim();
  if(lines.length<6||transcriptText.length<120)return NextResponse.json({error:'Transcript is too short to evaluate'},{status:400});
  if(ticket.length<30)return NextResponse.json({error:'A useful ticket is required'},{status:400});

  const supabase=createServerClient();
  const{data:session}=await supabase.from('sessions').select('id,transcript_text,candidate_ticket_text,scenarios(*)').eq('id',String(body.session_id||'')).eq('assessment_pack_id',context.pack.id).eq('tenant_id',context.pack.tenant_id).single();
  if(!session)return NextResponse.json({error:'Session not found'},{status:404});
  if(session.transcript_text||session.candidate_ticket_text)return NextResponse.json({error:'Call has already been submitted'},{status:409});

  const scenario=Array.isArray(session.scenarios)?session.scenarios[0]:session.scenarios;
  const required=(scenario?.required_checkpoints??{})as Record<string,boolean>;
  const results=body.checkpoint_results;
  const keys=Object.keys(required).filter((key)=>required[key]);
  const rubric=getRubric(scenario?.title ?? '', scenario?.rubric);

  // ── Path A: GPT provided checkpoint_results (backward compat) ─────────
  if(results&&typeof results==='object'&&keys.some((key)=>typeof results[key]?.passed==='boolean')){
    const call=calculateCheckpointScore(required,results);
    const ticketScoreResult=scoreTicket(ticket,transcriptText);
    const critical=call.criticalMisses.concat(ticketScoreResult.score<40?['usable_ticket']:[]);
    const finalScore=combineCallAndTicketScore(call.score,ticketScoreResult.score);
    const label=getFirstCallsReadiness(finalScore,critical);

    await supabase.from('sessions').update({
      transcript_json:lines,transcript_text:transcriptText,conversation_transcript:transcriptText,
      candidate_ticket_text:ticket,checkpoints:results,rubric_evidence:results,score:call.score,
      score_breakdown:{call_score:call.score,missed:call.missed,critical_misses:critical},
      ticket_assessed:true,ticket_score:ticketScoreResult,readiness_score:finalScore,readiness_label:label,
      feedback_text:String(body.feedback_summary||'').slice(0,4000),
    }).eq('id',session.id).eq('assessment_pack_id',context.pack.id);

    const{count}=await supabase.from('sessions').select('id',{count:'exact',head:true}).eq('assessment_pack_id',context.pack.id).not('candidate_ticket_text','is',null);
    const complete=(count??0)>=3;
    if(complete)await completeAssessmentPack(supabase,context.pack.id,context.pack.tenant_id);
    return NextResponse.json({saved:true,call_number:count??0,complete,next_step:complete?'assessment_complete':'start_next_call',evaluation_source:'gpt'});
  }

  // ── Path B: AI evaluator (new architecture) ────────────────────────────
  const openAIApiKey=process.env.OPENAI_API_KEY;
  const turns=lines.map((line:Line,i:number)=>({speaker:String(line.speaker),text:String(line.text).trim(),turnIndex:i+1}));

  const evaluationResult=await evaluateTranscript({
    scenarioTitle:scenario?.title??'',
    scenarioDescription:scenario?.issue_family??'',
    hiddenFacts:(scenario?.hidden_facts??{})as Record<string,unknown>,
    requiredCheckpoints:required,
    rubric,
    transcript:transcriptText,
    turns,
    ticket,
  }, '', openAIApiKey);

  const ticketScoreResult=scoreTicketWithPatterns(ticket,transcriptText);
  const scoringResult=calculateWeightedScore(rubric,evaluationResult.output,ticketScoreResult.score);

  // Store transcript
  const{data:transcriptRecord}=await supabase.from('assessment_call_transcripts').insert({
    assessment_session_id:session.id,
    candidate_id:candidate.id,
    scenario_id:scenario?.id,
    raw_transcript:transcriptText,
    source:'custom_gpt',
    transcript_version:1,
  }).select('id').single();

  const transcriptId=transcriptRecord?.id;

  // Store turns
  if(transcriptId){
    for(const turn of turns){
      await supabase.from('assessment_call_turns').insert({
        transcript_id:transcriptId,turn_index:turn.turnIndex,speaker:turn.speaker,text:turn.text,
      });
    }
  }

  // Store evaluation
  const{data:evalRecord}=await supabase.from('assessment_call_evaluations').insert({
    transcript_id:transcriptId,
    evaluator_model:evaluationResult.model,
    evaluator_prompt_version:evaluationResult.promptVersion,
    rubric_version:evaluationResult.rubricVersion,
    raw_ai_output_json:evaluationResult.output as unknown as Record<string,unknown>,
    validated:evaluationResult.valid,
    validation_errors:evaluationResult.errors,
    final_call_score:scoringResult.callScore,
    final_ticket_score:scoringResult.ticketScore,
    final_readiness_score:scoringResult.finalScore,
    readiness_label:scoringResult.readinessLabel,
  }).select('id').single();
  const evaluationId=evalRecord?.id;

  // Store evidence
  if(evaluationId){
    for(const ev of evaluationResult.output.checkpointEvidence){
      await supabase.from('assessment_evidence').insert({
        evaluation_id:evaluationId,assessment_session_id:session.id,
        checkpoint_key:ev.checkpointKey,status:ev.status,
        evidence_quote:ev.evidenceQuote,turn_index:ev.turnIndex,reason:ev.reason,confidence:ev.confidence,
      });
    }
  }

  // Store labels
  const storeLabel=async (labelType:string,labelKey:string,confidence:number,severity?:string,evidenceQuote?:string|null)=>{
    await supabase.from('assessment_labels').insert({
      assessment_session_id:session.id,transcript_id:transcriptId,
      label_type:labelType,label_key:labelKey,confidence,source:'ai',
      evidence_quote:evidenceQuote??null,severity:severity??null,
    });
  };
  for(const sl of evaluationResult.output.skillLabels)await storeLabel('skill',sl.label,sl.confidence,undefined,sl.evidenceQuote);
  for(const rl of evaluationResult.output.riskLabels)await storeLabel('risk',rl.label,rl.confidence,rl.severity,rl.evidenceQuote);
  for(const sl of evaluationResult.output.scenarioLabels)await storeLabel('scenario',sl,0.9);
  for(const dq of evaluationResult.output.dataQualityLabels)await storeLabel('data_quality',dq,0.9);
  await storeLabel('outcome',scoringResult.readinessLabel,0.85);

  // Update session
  const criticalMisses=evaluationResult.output.riskLabels
    .filter((r)=>['missed_identity_check','missed_company_check','missed_scope_check','missed_impact_check'].includes(r.label))
    .map((r)=>r.label);

  await supabase.from('sessions').update({
    transcript_json:lines,transcript_text:transcriptText,conversation_transcript:transcriptText,
    candidate_ticket_text:ticket,checkpoints:evaluationResult.output.checkpointEvidence.reduce((acc,ev)=>({...acc,[ev.checkpointKey]:{passed:ev.status==='observed',evidence:ev.evidenceQuote}}),{}),
    rubric_evidence:evaluationResult.output.checkpointEvidence.reduce((acc,ev)=>({...acc,[ev.checkpointKey]:ev.status==='observed'}),{}),
    score:scoringResult.callScore,
    score_breakdown:{call_score:scoringResult.callScore,ticket_score:scoringResult.ticketScore,final_score:scoringResult.finalScore,missed:scoringResult.missedPenalties,critical_misses:criticalMisses,risk_penalties:scoringResult.riskPenalties},
    ticket_assessed:true,ticket_score:{score:scoringResult.ticketScore,checks:ticketScoreResult.checks,feedback:ticketScoreResult.feedback},
    readiness_score:scoringResult.finalScore,readiness_label:scoringResult.readinessLabel,
    feedback_text:evaluationResult.output.callSummary.slice(0,4000),
  }).eq('id',session.id).eq('assessment_pack_id',context.pack.id);

  const{count}=await supabase.from('sessions').select('id',{count:'exact',head:true}).eq('assessment_pack_id',context.pack.id).not('candidate_ticket_text','is',null);
  const complete=(count??0)>=3;
  if(complete)await completeAssessmentPack(supabase,context.pack.id,context.pack.tenant_id);

  return NextResponse.json({
    saved:true,call_number:count??0,complete,
    next_step:complete?'assessment_complete':'start_next_call',
    evaluation_source:'ai',
    readiness_label:scoringResult.readinessLabel,
    readiness_score:scoringResult.finalScore,
  });
}

async function completeAssessmentPack(supabase:ReturnType<typeof createServerClient>,packId:string,tenantId:string){
  const{data:sessions}=await supabase.from('sessions').select('readiness_score,score_breakdown,readiness_label').eq('assessment_pack_id',packId);
  const average=Math.round((sessions??[]).reduce((sum,item)=>sum+(item.readiness_score??0),0)/Math.max(1,sessions?.length??0));
  const misses=(sessions??[]).flatMap((item)=>((item.score_breakdown as{critical_misses?:string[]}|null)?.critical_misses??[]));
  const labels=(sessions??[]).map((s)=>s.readiness_label).filter(Boolean);
  const worstLabel=labels.includes('not_ready')?'not_ready':labels.includes('ready_with_supervision')?'ready_with_supervision':'ready_low_risk_calls';
  await supabase.from('assessment_packs').update({
    status:'completed',completed_at:new Date().toISOString(),
    final_recommendation:worstLabel,
  }).eq('id',packId).eq('tenant_id',tenantId);
}
