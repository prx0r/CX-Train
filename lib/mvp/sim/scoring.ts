import { SimEvent, SimScoringResult, SimActionConfig } from './types';

export function scoreSimEvents(params: {
  actions: SimActionConfig[];
  events: SimEvent[];
  finalState: Record<string, unknown>;
}): SimScoringResult {
  const { actions, events, finalState } = params;

  const performedActionIds = new Set(
    events.filter(e => e.event_type === 'action_performed').map(e => e.action_id).filter(Boolean)
  );

  const redFlagEvents = events.filter(e => e.event_type === 'red_flag_triggered');
  const redFlagActionIds = new Set(redFlagEvents.map(e => e.action_id).filter(Boolean));

  // Check each required action
  const actionCriteria: Record<string, 'pass' | 'partial' | 'fail'> = {};

  const checkedStatus = performedActionIds.has('check_outlook_status');
  actionCriteria.checked_outlook_status = checkedStatus ? 'pass' : 'fail';

  // Check webmail: direct action OR chat mention
  const checkedWebmail = performedActionIds.has('check_webmail');
  const askedInChat = events.some(e =>
    e.event_type === 'candidate_message' &&
    e.result_text?.toLowerCase().includes('webmail')
  );
  actionCriteria.checked_webmail = checkedWebmail ? 'pass' : askedInChat ? 'partial' : 'fail';

  const disabledWFO = performedActionIds.has('toggle_work_offline');
  actionCriteria.disabled_work_offline = disabledWFO ? 'pass' : 'fail';

  const sentTest = performedActionIds.has('send_test_email');
  const toggledBeforeSend = (() => {
    const toggleIdx = events.findIndex(e => e.action_id === 'toggle_work_offline');
    const sendIdx = events.findIndex(e => e.action_id === 'send_test_email');
    return toggleIdx >= 0 && sendIdx > toggleIdx;
  })();
  actionCriteria.sent_test_email = sentTest && toggledBeforeSend ? 'pass' : sentTest ? 'partial' : 'fail';

  const redFlags = redFlagEvents.map(e => e.action_id).filter(Boolean) as string[];

  // Check avoided red flags
  const avoidedRedFlags = redFlags.length === 0;
  actionCriteria.avoided_red_flags = avoidedRedFlags ? 'pass' : 'fail';

  // Check dangerous red flags (reinstall/delete before status check)
  const reinstallBefore = redFlagActionIds.has('reinstall_outlook') && !checkedStatus;
  const deleteBefore = redFlagActionIds.has('delete_mail_profile') && !checkedStatus;
  const escalateBefore = redFlagActionIds.has('escalate_without_basic_checks') && !(checkedStatus || checkedWebmail);

  // Score delta calculation
  let scoreDelta = 0;
  if (checkedStatus) scoreDelta += 8;
  if (checkedWebmail) scoreDelta += 5;
  if (askedInChat && !checkedWebmail) scoreDelta += 2;
  if (disabledWFO) scoreDelta += 10;
  if (sentTest && toggledBeforeSend) scoreDelta += 10;
  if (sentTest && !toggledBeforeSend) scoreDelta += 5;
  if (avoidedRedFlags) scoreDelta += 7;
  if (reinstallBefore) scoreDelta -= 15;
  if (deleteBefore) scoreDelta -= 15;
  if (escalateBefore) scoreDelta -= 10;

  // Final state bonus
  if (finalState.test_email_sent) scoreDelta += 5;
  if (finalState.issue_resolved) scoreDelta += 5;
  if (finalState.ticket_note_submitted) scoreDelta += 5;

  scoreDelta = Math.max(0, Math.min(100, scoreDelta));

  // Timeline summary
  const timelineSummary: string[] = [];
  for (const ev of events) {
    if (ev.event_type === 'action_performed' && ev.label) {
      timelineSummary.push(`${ev.label} → ${ev.result_text || ''}`);
    } else if (ev.event_type === 'red_flag_triggered' && ev.label) {
      timelineSummary.push(`⚠ ${ev.label}`);
    }
  }

  // Technical path
  const technicalPath: string[] = [];
  if (checkedStatus) technicalPath.push('✓ Checked Outlook status before changing settings');
  else technicalPath.push('✗ Did not check Outlook status');
  if (checkedWebmail) technicalPath.push('✓ Checked webmail to isolate scope');
  if (askedInChat && !checkedWebmail) technicalPath.push('~ Asked about webmail in chat but did not verify directly');
  if (disabledWFO) technicalPath.push('✓ Found root cause (Work Offline)');
  else technicalPath.push('✗ Did not disable Work Offline');
  if (sentTest && toggledBeforeSend) technicalPath.push('✓ Tested fix after resolving root cause');
  else if (sentTest) technicalPath.push('~ Sent test email before confirming fix');
  else technicalPath.push('✗ Did not verify fix with test email');
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
