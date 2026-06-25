import { SimScoringResult, SimAction, SimState, TaxonomyTag } from './types';

export function scoreSimEvents(params: {
  pack: { actions: SimAction[]; rubric: Record<string, { weight: number }> };
  events: Array<{ event_type: string; action_id?: string | null; text?: string | null; label?: string | null; result_text?: string | null; payload?: Record<string, unknown> | null }>;
  finalState: SimState;
}): SimScoringResult {
  const { pack, events, finalState } = params;

  const performedActionIds = new Set(
    events.filter(e => e.event_type === 'action_performed').map(e => e.action_id).filter(Boolean)
  );

  const redFlagEvents = events.filter(e => e.event_type === 'red_flag_triggered');
  const redFlagActionIds = new Set(redFlagEvents.map(e => e.action_id).filter(Boolean));

  /* Check taxonomy tags directly from events */
  function hasTag(tag: TaxonomyTag): boolean {
    return events.some(e => {
      const payload = e.payload;
      if (!payload || !Array.isArray(payload.taxonomy_tags)) return false;
      return (payload.taxonomy_tags as string[]).includes(tag);
    });
  }

  function hasTagInEvent(actionId: string, tag: TaxonomyTag): boolean {
    return events.some(e => {
      if (e.action_id !== actionId) return false;
      const payload = e.payload;
      if (!payload || !Array.isArray(payload.taxonomy_tags)) return false;
      return (payload.taxonomy_tags as string[]).includes(tag);
    });
  }

  /* ── Criteria computation ─────────────────────────── */

  const actionCriteria: Record<string, 'pass' | 'partial' | 'fail'> = {};

  const askedImpact = finalState.evidence.askedImpact || hasTag('communication.impact_question');
  actionCriteria.asked_impact = askedImpact ? 'pass' : 'fail';

  const askedScope = finalState.evidence.askedScope || hasTag('communication.scope_question');
  actionCriteria.asked_scope = askedScope ? 'pass' : 'fail';

  const confirmedUser = finalState.evidence.confirmedUser || hasTag('communication.user_confirmation');
  actionCriteria.confirmed_user = confirmedUser ? 'pass' : 'fail';

  const openedOutlook = performedActionIds.has('open_outlook');
  actionCriteria.opened_outlook = openedOutlook ? 'pass' : 'fail';

  const checkedStatus = performedActionIds.has('check_outlook_status') || hasTagInEvent('check_outlook_status', 'tool.outlook.check_status');
  actionCriteria.checked_outlook_status = checkedStatus ? 'pass' : 'fail';

  const checkedWebmail = performedActionIds.has('check_webmail') || hasTagInEvent('check_webmail', 'tool.browser.check_webmail');
  actionCriteria.checked_webmail = checkedWebmail ? 'pass' : 'fail';

  const disabledWFO = performedActionIds.has('disable_work_offline');
  actionCriteria.disabled_work_offline = disabledWFO ? 'pass' : 'fail';

  const sentTestOrSendReceive = performedActionIds.has('send_test_email') || performedActionIds.has('send_receive');
  actionCriteria.verified_fix = sentTestOrSendReceive ? 'pass' : 'fail';

  const usedKB = performedActionIds.has('search_kb_outlook');
  actionCriteria.used_knowledge_base = usedKB ? 'pass' : 'fail';

  const redFlags = redFlagEvents.map(e => e.action_id).filter(Boolean) as string[];

  const avoidedRedFlags = redFlags.length === 0;
  actionCriteria.avoided_red_flags = avoidedRedFlags ? 'pass' : 'fail';

  const reinstallBefore = redFlagActionIds.has('reinstall_outlook') && !checkedStatus;
  const deleteBefore = redFlagActionIds.has('delete_mail_profile') && !checkedStatus;
  const escalateBefore = redFlagActionIds.has('escalate_without_checks') && !(checkedStatus || checkedWebmail);
  const guessedBefore = redFlagActionIds.has('blame_outage') && !checkedStatus;

  /* ── Score delta computation ──────────────────────── */

  let scoreDelta = 0;

  if (askedImpact) scoreDelta += 8;
  if (askedScope) scoreDelta += 8;
  if (confirmedUser) scoreDelta += 5;
  if (openedOutlook) scoreDelta += 5;
  if (checkedStatus) scoreDelta += 15;
  if (checkedWebmail) scoreDelta += 10;
  if (disabledWFO) scoreDelta += 20;
  if (sentTestOrSendReceive) scoreDelta += 10;
  if (usedKB) scoreDelta += 5;
  if (avoidedRedFlags) scoreDelta += 10;

  if (reinstallBefore) scoreDelta -= 20;
  if (deleteBefore) scoreDelta -= 20;
  if (escalateBefore) scoreDelta -= 15;
  if (guessedBefore) scoreDelta -= 20;

  if (finalState.phase === 'submitted') scoreDelta += 5;
  if (sentTestOrSendReceive && disabledWFO) scoreDelta += 5;

  scoreDelta = Math.max(0, Math.min(100, scoreDelta));

  /* ── Timeline summary ──────────────────────────────── */
  const timelineSummary: string[] = [];
  for (const ev of events) {
    if (ev.event_type === 'customer_message' && ev.text) {
      timelineSummary.push(`[Customer] ${ev.text}`);
    } else if (ev.event_type === 'candidate_message' && ev.text) {
      timelineSummary.push(`[Candidate] ${ev.text}`);
    } else if (ev.event_type === 'action_performed' && ev.label) {
      timelineSummary.push(`[Action] ${ev.label} → ${ev.result_text || ''}`);
    } else if (ev.event_type === 'observation_returned' && ev.result_text) {
      timelineSummary.push(`[System] ${ev.result_text}`);
    } else if (ev.event_type === 'red_flag_triggered' && ev.label) {
      timelineSummary.push(`[Red Flag] ⚠ ${ev.label}`);
    }
  }

  /* ── Technical path ────────────────────────────────── */
  const technicalPath: string[] = [];
  if (confirmedUser) technicalPath.push('✓ Identified the user');
  else technicalPath.push('✗ Did not identify user');
  if (askedScope) technicalPath.push('✓ Asked scope (one user or many)');
  else technicalPath.push('✗ Did not ask scope');
  if (askedImpact) technicalPath.push('✓ Asked business impact');
  else technicalPath.push('✗ Did not ask impact');
  if (openedOutlook) technicalPath.push('✓ Opened Outlook to investigate');
  else technicalPath.push('✗ Did not open Outlook');
  if (checkedStatus) technicalPath.push('✓ Checked Outlook connection status');
  else technicalPath.push('✗ Did not check connection status');
  if (checkedWebmail) technicalPath.push('✓ Checked webmail to isolate scope');
  else technicalPath.push('✗ Did not check webmail');
  if (disabledWFO) technicalPath.push('✓ Disabled Work Offline (correct fix)');
  else technicalPath.push('✗ Did not disable Work Offline');
  if (sentTestOrSendReceive) technicalPath.push('✓ Verified fix with test email');
  else technicalPath.push('✗ Did not verify the fix');
  if (usedKB) technicalPath.push('✓ Used knowledge base');
  if (avoidedRedFlags) technicalPath.push('✓ Avoided dangerous actions');
  if (redFlags.length > 0) technicalPath.push(`⚠ Triggered red flags: ${redFlags.join(', ')}`);

  return {
    actionCriteria,
    redFlags,
    scoreDelta,
    timelineSummary,
    technicalPath,
  };
}
