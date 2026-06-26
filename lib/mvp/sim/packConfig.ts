import { SimPack, SimState } from './types';

export const OUTLOOK_WORK_OFFLINE_PACK_ID = 'pack-outlook-sim-v2';

export function getInitialState(): SimState {
  return {
    phase: 'not_started',
    call: {
      startedAt: null,
      endedAt: null,
      customerMood: 'frustrated',
      factsRevealed: [],
    },
    remote: {
      connected: false,
      deviceName: 'ALDER-LT-023',
      currentApp: 'none',
    },
    toolStates: {
      outlook: {
        workOffline: true,
        outboxCount: 3,
        sentTestEmail: false,
        profileCorrupt: false,
      },
      network: {
        internetReachable: true,
        dnsWorks: true,
        exchangeReachable: true,
      },
      connectwise: {
        ticketId: null,
        priority: null,
        status: null,
        notes: [],
        kbArticlesViewed: [],
        assetsViewed: [],
      },
    },
    evidence: {
      askedImpact: false,
      askedScope: false,
      confirmedUser: false,
      confirmedDevice: false,
      checkedObviousCause: false,
      verifiedFix: false,
    },
    flags: {
      guessedWithoutEvidence: false,
      performedRiskyAction: false,
      ignoredUserEmotion: false,
    },
    discovered: [],
  };
}

export function getOutlookWorkOfflinePack(): SimPack {
  return {
    id: OUTLOOK_WORK_OFFLINE_PACK_ID,
    version: '2.0',
    title: 'Outlook Not Sending — Work Offline',
    mode: 'dashboard_sim',

    customer: {
      name: 'Sarah',
      company: 'Connexion Dental',
      role: 'Accounts',
      temperament: 'stressed',
      openingLine: "Hi, this is Sarah from Accounts. Outlook won't send my emails. I really need to get this sorted — I have invoices that need to go out this morning.",
    },

    initialState: getInitialState(),

    hiddenTruth: {
      rootCause: 'Outlook is stuck in Work Offline mode',
      correctFix: 'Disable Work Offline in Outlook, then send/receive to clear Outbox',
      idealDiagnosticPath: [
        'Open Outlook',
        'Check Outbox for stuck messages',
        'Check Outlook status / connection',
        'Notice Work Offline is enabled',
        'Disable Work Offline',
        'Send test email or confirm Outbox clears',
        'Verify with customer that email sent',
      ],
      factsOnlyRevealAfter: {
        'checked_outlook_status': ['I think I remember clicking something in Outlook yesterday — it said Work Offline or something.'],
        'checked_work_offline_in_chat': ['Actually, yes — I noticed Outlook said Working Offline at the bottom.'],
      },
    },

    tools: ['customer_chat', 'ticket', 'outlook', 'browser', 'cmd', 'control_panel', 'connectwise', 'notes', 'network', 'vpn', 'printer'],

    actions: [
      /* ── Call lifecycle ────────────────────────────── */
      {
        id: 'start_call',
        tool: 'customer_chat',
        label: 'Start call',
        allowedPhases: ['not_started'],
        observation: 'Call connected. Customer is on the line.',
        scoreImpact: { positive: ['call_control'] },
      },
      {
        id: 'end_call',
        tool: 'customer_chat',
        label: 'End call',
        allowedPhases: ['call_active', 'remote_active'],
        effects: { 'call.endedAt': '$now' as any },
        observation: 'Call ended. Proceed to write your ticket.',
        scoreImpact: { positive: ['call_control'] },
      },

      /* ── Remote access ─────────────────────────────── */
      {
        id: 'remote_connect',
        tool: 'connectwise',
        label: 'Remote into ALDER-LT-023',
        allowedPhases: ['call_active'],
        effects: {
          'remote.connected': true,
          'remote.currentApp': 'none',
        },
        observation: 'Remote session established with ALDER-LT-023. Windows desktop visible.',
        taxonomyTags: ['tool.remote.connect'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'remote_disconnect',
        tool: 'connectwise',
        label: 'Disconnect Remote Desktop',
        allowedPhases: ['remote_active'],
        effects: {
          'remote.connected': false,
          'remote.currentApp': 'none',
        },
        observation: 'Remote session disconnected. Returned to call view.',
        taxonomyTags: ['tool.remote.disconnect'],
      },

      /* ── Outlook actions ───────────────────────────── */
      {
        id: 'open_outlook',
        tool: 'outlook',
        label: 'Open Outlook',
        allowedPhases: ['remote_active'],
        effects: { 'remote.currentApp': 'outlook' },
        observation: 'Outlook opens. The status bar at the bottom shows "Work Offline" and the Outbox shows 3 unsent messages.',
        taxonomyTags: ['tool.outlook.open'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'check_outbox',
        tool: 'outlook',
        label: 'Check Outbox',
        allowedPhases: ['remote_active'],
        requiresState: { 'remote.currentApp': 'outlook' },
        observation: 'Outbox contains 3 unsent emails, all addressed to external recipients. They appear stuck.',
        taxonomyTags: ['tool.outlook.check_outbox'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'check_outlook_status',
        tool: 'outlook',
        label: 'Check Outlook status / connection',
        allowedPhases: ['remote_active'],
        requiresState: { 'remote.currentApp': 'outlook' },
        effects: {
          'evidence.checkedObviousCause': true,
        },
        observation: 'Outlook connection status: "Work Offline" is enabled. The Send/Receive indicator shows disconnected.',
        revealsFacts: ['Outlook is in Work Offline mode'],
        taxonomyTags: ['tool.outlook.check_status', 'diagnostic.application_state_checked'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'disable_work_offline',
        tool: 'outlook',
        label: 'Turn off Work Offline',
        allowedPhases: ['remote_active'],
        requiresState: { 'remote.currentApp': 'outlook' },
        effects: {
          'toolStates.outlook.workOffline': false,
          'evidence.checkedObviousCause': true,
        },
        observation: 'Work Offline is now disabled. Outlook reconnects to Exchange. The status bar shows "Connected."',
        revealsFacts: ['Work Offline was the cause'],
        taxonomyTags: ['tool.outlook.disable_work_offline', 'fix.correct_root_cause'],
        scoreImpact: { positive: ['fix'] },
      },
      {
        id: 'send_receive',
        tool: 'outlook',
        label: 'Send/Receive all folders',
        allowedPhases: ['remote_active'],
        requiresState: { 'toolStates.outlook.workOffline': false },
        strictPreconditions: true,
        effects: {
          'toolStates.outlook.outboxCount': 0,
          'toolStates.outlook.sentTestEmail': true,
        },
        observation: 'Send/Receive completes. Outbox is now empty — all 3 messages sent successfully.',
        failureObservation: 'The attempt does not complete. Outlook is still disconnected, so mail remains in the Outbox.',
        taxonomyTags: ['tool.outlook.send_receive', 'verification.test_email_sent'],
        scoreImpact: { positive: ['fix', 'verification'] },
      },
      {
        id: 'send_test_email',
        tool: 'outlook',
        label: 'Send a test email',
        allowedPhases: ['remote_active'],
        requiresState: { 'toolStates.outlook.workOffline': false },
        strictPreconditions: true,
        effects: {
          'toolStates.outlook.sentTestEmail': true,
          'evidence.verifiedFix': true,
        },
        observation: 'Test email sent to the customer. Customer confirms "Yes, I received it!"',
        failureObservation: 'The attempt does not complete. Outlook is still disconnected, so mail remains in the Outbox.',
        taxonomyTags: ['tool.outlook.send_test_email', 'verification.test_email_sent', 'verification.user_confirmed'],
        scoreImpact: { positive: ['verification'] },
      },

      /* ── Browser / webmail actions ────────────────── */
      {
        id: 'open_browser',
        tool: 'browser',
        label: 'Open browser',
        allowedPhases: ['remote_active'],
        effects: { 'remote.currentApp': 'browser' },
        observation: 'Browser opens to the default homepage.',
        taxonomyTags: ['tool.browser.open'],
      },
      {
        id: 'check_webmail',
        tool: 'browser',
        label: 'Check Outlook Web App',
        allowedPhases: ['remote_active'],
        requiresState: { 'remote.currentApp': 'browser' },
        effects: { 'toolStates.network.exchangeReachable': true },
        observation: 'Outlook Web App loads successfully and can send email. Issue is isolated to the desktop client.',
        taxonomyTags: ['tool.browser.check_webmail', 'diagnostic.scope_isolation'],
        scoreImpact: { positive: ['diagnosis'] },
      },

      /* ── CMD / network diagnostics ─────────────────── */
      {
        id: 'run_ping',
        tool: 'cmd',
        label: 'Ping outlook.office365.com',
        allowedPhases: ['remote_active'],
        effects: { 'remote.currentApp': 'cmd' },
        observation: 'Reply from 52.96.x.x: bytes=32 time=24ms TTL=114. Internet connectivity and DNS are working.',
        taxonomyTags: ['tool.cmd.ping', 'diagnostic.connectivity_verified'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'run_ipconfig',
        tool: 'cmd',
        label: 'Run ipconfig',
        allowedPhases: ['remote_active'],
        effects: { 'remote.currentApp': 'cmd' },
        observation: 'IP config shows DHCP lease active, DNS servers: 8.8.8.8 / 8.8.4.4.',
        taxonomyTags: ['tool.cmd.ipconfig'],
      },

      /* ── ConnectWise / ITSM actions ────────────────── */
      {
        id: 'open_ticket',
        tool: 'connectwise',
        label: 'Open ticket in ConnectWise',
        allowedPhases: ['remote_active', 'ticketing'],
        effects: {
          'toolStates.connectwise.ticketId': 'TKT-2847',
          'toolStates.connectwise.status': 'In Progress',
        },
        observation: 'Ticket TKT-2847 opened for Sarah Thompson / Connexion Dental.',
        taxonomyTags: ['tool.connectwise.open_ticket'],
      },
      {
        id: 'update_priority',
        tool: 'connectwise',
        label: 'Set priority to High',
        allowedPhases: ['remote_active', 'ticketing'],
        effects: { 'toolStates.connectwise.priority': 'High' },
        observation: 'Priority set to High — invoices need to go out this morning.',
        taxonomyTags: ['tool.connectwise.set_priority', 'ticket.urgency_noted'],
        scoreImpact: { positive: ['ticket'] },
      },
      {
        id: 'add_ticket_note',
        tool: 'connectwise',
        label: 'Add note to ticket',
        allowedPhases: ['remote_active', 'ticketing'],
        observation: 'Note added to ticket.',
        taxonomyTags: ['tool.connectwise.add_note'],
      },
      {
        id: 'search_kb_outlook',
        tool: 'connectwise',
        label: 'Search KB: Outlook not sending',
        allowedPhases: ['remote_active'],
        effects: { 'toolStates.connectwise.kbArticlesViewed': ['outlook-work-offline'] },
        observation: 'KB article "Outlook stuck in Work Offline" found at KB-4421. Suggests checking connection status and disabling Work Offline.',
        taxonomyTags: ['tool.connectwise.search_kb', 'diagnostic.kb_used'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'view_asset',
        tool: 'connectwise',
        label: 'View asset ALDER-LT-023',
        allowedPhases: ['remote_active'],
        effects: { 'toolStates.connectwise.assetsViewed': ['ALDER-LT-023'] },
        observation: 'Asset ALDER-LT-023: Dell Latitude 5540, Windows 11, Outlook 365. Last patched 5 days ago.',
        taxonomyTags: ['tool.connectwise.view_asset'],
        scoreImpact: { positive: ['diagnosis'] },
      },

      /* ── Red flag actions ──────────────────────────── */
      {
        id: 'reinstall_outlook',
        tool: 'control_panel',
        label: 'Reinstall Outlook (Programs and Features)',
        allowedPhases: ['remote_active'],
        observation: 'This is a disruptive fix to attempt before checking basic causes like Work Offline.',
        redFlag: {
          id: 'jumped_to_disruptive_fix',
          severity: 'major',
          message: 'Candidate attempted a disruptive fix (reinstall) before checking obvious causes.',
        },
        taxonomyTags: ['red_flag.disruptive_fix_before_basic_checks'],
        scoreImpact: { negative: ['fix'] },
      },
      {
        id: 'delete_mail_profile',
        tool: 'control_panel',
        label: 'Delete and recreate Outlook profile (Mail in Control Panel)',
        allowedPhases: ['remote_active'],
        observation: 'This is a destructive step — it will delete all cached data and require profile reconfiguration.',
        redFlag: {
          id: 'destructive_action_without_evidence',
          severity: 'major',
          message: 'Candidate attempted a destructive profile deletion before checking basic connection status.',
        },
        taxonomyTags: ['red_flag.destructive_action_without_evidence'],
        scoreImpact: { negative: ['fix'] },
      },
      {
        id: 'escalate_without_checks',
        tool: 'connectwise',
        label: 'Escalate to Tier 2',
        allowedPhases: ['remote_active'],
        observation: 'Escalation is premature. Basic checks (connection status, Outbox, webmail) have not been completed.',
        redFlag: {
          id: 'escalate_without_basic_checks',
          severity: 'major',
          message: 'Candidate escalated to Tier 2 without performing basic diagnostic checks.',
        },
        taxonomyTags: ['red_flag.escalate_without_basic_checks'],
        scoreImpact: { negative: ['diagnosis'] },
      },
      {
        id: 'blame_outage',
        tool: 'customer_chat',
        label: 'Tell customer it is a Microsoft outage',
        allowedPhases: ['call_active', 'remote_active'],
        observation: 'Candidate blamed a Microsoft outage without any evidence. Customer is not reassured.',
        redFlag: {
          id: 'guessed_without_evidence',
          severity: 'major',
          message: 'Candidate blamed a service outage without running any diagnostics.',
        },
        effects: { 'flags.guessedWithoutEvidence': true },
        taxonomyTags: ['red_flag.guessed_root_cause_without_evidence'],
        scoreImpact: { negative: ['diagnosis'] },
      },
    ],

    rubric: {
      call_control: { weight: 3, label: 'Call control and opening' },
      diagnosis: { weight: 5, label: 'Diagnostic process' },
      fix: { weight: 5, label: 'Technical fix' },
      verification: { weight: 3, label: 'Verification and closure' },
      ticket: { weight: 3, label: 'Ticket quality' },
      professionalism: { weight: 2, label: 'Professionalism and communication' },
    },

    redFlags: [
      { id: 'jumped_to_disruptive_fix', severity: 'major', message: 'Jumped to disruptive fix before basic checks' },
      { id: 'destructive_action_without_evidence', severity: 'major', message: 'Destructive action before evidence' },
      { id: 'escalate_without_basic_checks', severity: 'major', message: 'Escalated without basic checks' },
      { id: 'guessed_without_evidence', severity: 'major', message: 'Guessed root cause without evidence' },
    ],

    idealTicket: {
      summary: 'Outlook stuck in Work Offline mode for Sarah Thompson at Connexion Dental',
      requiredFields: ['user', 'company', 'device', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'root_cause', 'resolution', 'verification', 'next_step'],
      mustMention: [
        'Sarah Thompson',
        'Connexion Dental',
        'Outlook Work Offline',
        'Outbox cleared',
        'test email sent',
      ],
      mustNotInvent: [
        'hardware fault',
        'server outage',
        'Exchange server down',
        'corrupt PST',
      ],
    },

    scoringCriteria: [
      { id: 'asked_impact', label: 'Asked business impact', weight: 8, check: 'tag_present', target: 'communication.impact_question' },
      { id: 'asked_scope', label: 'Asked scope', weight: 8, check: 'tag_present', target: 'communication.scope_question' },
      { id: 'confirmed_user', label: 'Confirmed user identity', weight: 5, check: 'tag_present', target: 'communication.user_confirmation' },
      { id: 'opened_outlook', label: 'Opened Outlook', weight: 5, check: 'action_performed', target: 'open_outlook' },
      { id: 'checked_status', label: 'Checked Outlook status', weight: 15, check: 'action_performed', target: 'check_outlook_status' },
      { id: 'checked_webmail', label: 'Checked webmail', weight: 10, check: 'action_performed', target: 'check_webmail' },
      { id: 'disabled_wfo', label: 'Disabled Work Offline', weight: 20, check: 'action_performed', target: 'disable_work_offline' },
      { id: 'verified_fix', label: 'Verified fix', weight: 10, check: 'action_performed', target: 'send_test_email' },
      { id: 'used_kb', label: 'Used knowledge base', weight: 5, check: 'action_performed', target: 'search_kb_outlook' },
      { id: 'avoided_red_flags', label: 'Avoided red flags', weight: 10, check: 'state_value', target: 'flags.guessedWithoutEvidence', value: false },
    ],

    diagnosticChecklist: [
      { id: 'confirmed_user', label: 'Identified the user', criteria: 'confirmed_user' },
      { id: 'asked_scope', label: 'Asked scope (one user or many)', criteria: 'asked_scope' },
      { id: 'asked_impact', label: 'Asked business impact', criteria: 'asked_impact' },
      { id: 'opened_outlook', label: 'Opened Outlook to investigate', criteria: 'opened_outlook' },
      { id: 'checked_status', label: 'Checked Outlook connection status', criteria: 'checked_status' },
      { id: 'checked_webmail', label: 'Checked webmail to isolate scope', criteria: 'checked_webmail' },
      { id: 'disabled_wfo', label: 'Disabled Work Offline (correct fix)', criteria: 'disabled_wfo' },
      { id: 'verified_fix', label: 'Verified fix with test email', criteria: 'verified_fix' },
      { id: 'used_kb', label: 'Used knowledge base', criteria: 'used_kb' },
      { id: 'avoided_red_flags', label: 'Avoided dangerous actions', criteria: 'avoided_red_flags' },
    ],
  };
}
