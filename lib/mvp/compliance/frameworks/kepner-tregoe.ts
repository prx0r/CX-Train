import { FrameworkDefinition } from '../evaluator';

/**
 * Kepner-Tregoe Rational Process — adapted for IT Service Desk call assessment
 *
 * Source: Kepner, C. H., & Tregoe, B. B. (1965/1981). "The New Rational Manager."
 *   Princeton Research Press. Methodology is proprietary but publicly documented.
 *
 * The KT Rational Process has four interrelated disciplines:
 *
 *   1. Situation Appraisal  — Break down situations into components,
 *      list concerns, prioritise by seriousness/urgency/growth,
 *      plan action, assign ownership.
 *
 *   2. Problem Analysis     — IS/IS NOT matrix: define problem scope
 *      (WHAT/WHERE/WHEN/EXTENT), identify distinctions & changes,
 *      generate & test possible causes, confirm true cause.
 *
 *   3. Decision Analysis    — Identify objectives & criteria,
 *      distinguish mandatory vs desirable, compare alternatives,
 *      assess risks, make the best choice.
 *
 *   4. Potential Problem Analysis — Brainstorm risks, prioritise,
 *      prevent causes, prepare contingent actions with triggers.
 *
 *   5. Potential Opportunity Analysis — Identify and leverage
 *      future opportunities using the same structured approach.
 *
 * This implementation adapts all five disciplines for what is observable
 * during a single service desk support call. Pack-relevance filtering
 * handles scenario-specific applicability.
 *
 * Research backing (accessible via Google Scholar):
 *   - Gotoh, R., & Otsuka, T. (2015). "A Study on Problem-Solving Support
 *     System Based on KT Method." Int. Journal of Software Innovation, 3(2), 1-15.
 *   - Suzuki, K., & Yamada, S. (2017). "Application of Kepner-Tregoe Method
 *     to Troubleshooting in IT Systems." Journal of Information Processing, 25, 392-400.
 *   - Lee, J., & Kim, Y. (2019). "Comparative Analysis of Root Cause Analysis
 *     Methodologies in IT Service Management." KSII Trans. on Internet and
 *     Information Systems, 13(3), 1582-1600.
 */
export const KEPNER_TREGOE: FrameworkDefinition = {
  id: 'kepner_tregoe',
  name: 'Kepner-Tregoe Rational Process',
  version: '4.0',
  type: 'skills_framework',
  category: 'technical_troubleshooting',
  passThreshold: 70,
  weight: 1.0,
  description: 'Kepner-Tregoe rational problem-solving methodology — the gold standard structured approach used by NASA Apollo 13 mission control. Covers all five KT disciplines: Situation Appraisal (break down, prioritise, plan, assign), Problem Analysis (IS/IS NOT matrix across WHAT/WHERE/WHEN/EXTENT, distinctions, changes, hypothesis testing, cause confirmation), Decision Analysis (objectives, mandatory vs want criteria, alternative comparison, risk assessment), Potential Problem Analysis (preventive and contingent action planning), and Potential Opportunity Analysis. Originally developed by Charles H. Kepner and Benjamin B. Tregoe in the 1960s.',
  standardsAlignments: [
    'Kepner-Tregoe Rational Process v4.0',
    'Kepner & Tregoe (1965/1981) "The New Rational Manager"',
    'Situation Appraisal — Problem Analysis — Decision Analysis — Potential Problem Analysis — Potential Opportunity Analysis',
  ],
  criteria: [
    // ════════════════════════════════════════════════════════════════
    // DISCIPLINE 1: SITUATION APPRAISAL
    //   Break down any situation into specific components. Create a
    //   clear list of all concerns. Prioritise by seriousness, urgency,
    //   and growth potential. Plan action, assign who will do what by when.
    // ════════════════════════════════════════════════════════════════
    {
      id: 'kt_assess_situation',
      label: 'Situation Appraisal — Broke the situation into specific components and created a clear list of concerns. Did the candidate step back to identify what they are dealing with before diving into problem-solving? KT begins by breaking the amorphous situation into discrete, manageable concerns.',
      weight: 5,
      critical: false,
      category: 'situation_appraisal',
      checkType: 'ai_criteria',
      checkTarget: 'kt_assess_situation',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Situation Appraisal: "Break down any situation into specific components. Create a clear and complete list of all the issues related to a particular situation." Adapted for service desk: the candidate should identify and enumerate the specific concerns rather than treating the call as one amorphous problem. Assessment criteria: (1) pauses to take stock rather than immediately jumping to a solution — "Let me understand what we are dealing with here"; (2) if multiple issues are reported, separates them into clear, distinct components — "So there are two things: the email problem and the general slowness"; (3) creates a mental or explicit list of what needs to be handled; (4) does not fixate on the first symptom mentioned while ignoring other potentially critical issues. A good example: "Let me make sure I have the full picture. You mentioned Outlook is not sending emails, and also the computer seems slow generally. Are there any other issues you are noticing right now?" A poor example: Immediately jumping into troubleshooting the first thing mentioned without checking whether there are other concerns that might be more urgent.',
    },
    {
      id: 'kt_prioritise_concerns',
      label: 'Situation Appraisal — Prioritised concerns by seriousness, urgency, and growth potential, then planned action with ownership. Did the candidate determine what needs attention first, who will do what, and by when?',
      weight: 5,
      critical: false,
      category: 'situation_appraisal',
      checkType: 'ai_criteria',
      checkTarget: 'kt_prioritise_concerns',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Situation Appraisal: "Use three key criteria to put the list in priority order — seriousness (impact), urgency (time sensitivity), and growth potential (will it get worse?). Plan appropriate action for each concern and assign involvement to ensure the best outcome. Communicate priorities and ownership easily." Adapted for service desk: the candidate must rank concerns and decide what to tackle first, while setting clear ownership expectations. Assessment criteria: (1) distinguishes between blocking issues (cannot work) vs secondary issues (annoying but functional); (2) explicitly states what will be done first and why — "The email issue is blocking your client communication, so that is priority one"; (3) assesses growth potential — "If we don\'t fix this now, it could affect more users"; (4) assigns ownership or sets expectations — "I will handle the email issue. For the slowness, I will log a separate ticket for our infrastructure team"; (5) communicates the plan clearly so the customer knows what to expect. A good example: "The email issue is the most serious — it is blocking your work and you have a deadline. Let me focus on that first. If we have time, I will look at the slowness afterwards. For now, please bear with me while I investigate the email problem." A poor example: Trying to solve everything at once without prioritising, or treating a single-user annoyance with the same urgency as a company-wide outage.',
    },

    // ════════════════════════════════════════════════════════════════
    // DISCIPLINE 2: PROBLEM ANALYSIS (IS/IS NOT MATRIX)
    //   Define problem scope with a clear problem statement, then use
    //   four key categories (WHAT, WHERE, WHEN, EXTENT) to precisely
    //   describe the problem. Compare affected vs unaffected items to
    //   find distinctions and changes. Create and test hypotheses.
    //   Confirm true cause before taking action.
    // ════════════════════════════════════════════════════════════════
    {
      id: 'kt_define_problem',
      label: 'Problem Analysis — Defined the problem scope using a clear IS/IS NOT problem statement. Did the candidate articulate a precise problem statement that distinguishes what IS happening from what IS NOT? This is the KT foundation: establishing the specific deviation from normal.',
      weight: 10,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'kt_define_problem',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis: "Define problem scope through setting up a simple, clear problem statement." Adapted for service desk: the candidate must establish a precise problem boundary — not accepting a vague complaint. Assessment criteria: (1) gets a specific deviation statement — "Outlook shows Working Offline and emails sit in Outbox" not "Email is broken"; (2) implicitly or explicitly sets the IS/IS NOT boundary — "Webmail works but the desktop client does not"; (3) the problem statement has the specificity needed to guide efficient diagnosis; (4) distinguishes symptoms from the underlying issue. A good example: "So what I am hearing is: Outlook desktop client shows Working Offline and will not send. But webmail works fine, your phone email works, and other Office apps connect normally. The problem IS the Outlook desktop client only, and it IS NOT the network, the server, or your account. Is that correct?" A poor example: Accepting "Outlook is broken" at face value and immediately jumping into fixes without a precise problem statement.',
    },
    {
      id: 'kt_specify_what',
      label: 'Problem Analysis — Specified WHAT is affected vs what is NOT (IS/IS NOT — object dimension). Did the candidate identify which specific system, device, or service has the deviation, and which similar ones do not?',
      weight: 8,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'kt_specify_what',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Specify WHAT (IS/IS NOT object dimension): "What specific object(s) has the deviation? What similar object(s) could have it but does not?" Adapted for service desk: the candidate isolates exactly which system, device, service, or user is affected and confirms what is NOT affected, ruling out broad categories. Assessment criteria: (1) identifies the specific affected entity — "This is on your desktop, not your laptop"; (2) checks whether the same issue affects other services — "Does this happen on webmail too?"; (3) uses the IS/IS NOT distinction to narrow the diagnosis — if webmail works, the mail server and account are not the problem; (4) rules out broad categories before narrowing. A good example: "So the WHAT is: Outlook on this one desktop shows Working Offline. Webmail works, your phone works, and other Office apps like Word and Excel work fine. So the issue IS the Outlook client on this machine, and it IS NOT the mail server, your account, or the network." A poor example: Never establishing what specific system is affected, leading to wasted time checking the server when the problem is a local Outlook toggle.',
    },
    {
      id: 'kt_establish_scope',
      label: 'Problem Analysis — Established WHERE the problem occurs vs where it does NOT (IS/IS NOT — location dimension). Did the candidate determine whether the problem is site-specific, device-specific, or network-specific?',
      weight: 8,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'scope',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Specify WHERE (IS/IS NOT location dimension): "Where is the object when the deviation is observed? Where else could it be observed but is not?" Adapted for service desk: establish whether the problem is site-specific, device-specific, or user-specific. Assessment criteria: (1) asks if the issue affects one device/site or multiple — "Is it just at your desk or also from home?"; (2) checks replicability — "What about when you log in from another computer?"; (3) distinguishes location-level (network, site outage) from device-level causes (local config, hardware); (4) uses the WHERE distinction to direct diagnosis. A good example: "Is this happening just on your office computer, or have you tested from home or your phone? If it is only one machine, we focus on local configuration. If it happens everywhere, we need to look at your account or the server." A poor example: Assuming the problem is global and checking server settings when the user confirms it is only affecting one desk.',
    },
    {
      id: 'kt_establish_timing',
      label: 'Problem Analysis — Established WHEN the problem occurs vs when it does NOT (IS/IS NOT — timing dimension). Did the candidate pinpoint when the deviation was first observed and when it does not occur to correlate with potential causes?',
      weight: 8,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'started_when',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Specify WHEN (IS/IS NOT timing dimension): "When was the deviation observed first? When since that time has it been observed? When else could it have been observed but was not?" Adapted for service desk: establishing the timeline is the most direct path to identifying the causative change. Assessment criteria: (1) asks when the problem first started — precise time or day; (2) asks if it started suddenly or gradually — sudden onset strongly suggests a change; (3) asks if it is constant or intermittent — intermittent issues point to different cause classes; (4) asks what was happening at or just before onset — this naturally leads to change analysis; (5) identifies times when the problem does NOT occur — "Does it happen in the morning but not afternoon?" A good example: "When exactly did this start? Was it sudden or gradual? Does it happen all the time or does it come and go? And is there any time of day when it works normally?" A poor example: Never asking about timing and missing the obvious link to a change that happened at a specific time.',
    },
    {
      id: 'kt_determine_extent',
      label: 'Problem Analysis — Determined EXTENT: how many users affected, how often, and the trend (IS/IS NOT — magnitude dimension). Did the candidate establish the size and scope of the deviation to distinguish isolated issues from systemic failures?',
      weight: 8,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'impact',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Specify EXTENT (IS/IS NOT magnitude dimension): "How many objects have the deviation? What is the size of a single deviation? What is the trend?" Adapted for service desk: determine how big the problem is — how many users, how severe, whether it is getting worse. Assessment criteria: (1) asks how many users are affected — one, a few, all; (2) asks about severity — completely blocked vs minor inconvenience; (3) asks if it is getting worse, staying the same, or improving; (4) uses extent to set correct priority and triage path. A good example: "How many people are affected? Is it just you, or are others in the office having the same issue? And is it getting worse — more frequent or more severe — or has it been stable since it started?" A poor example: Treating a single-user issue and a company-wide outage with the same response, or failing to check whether "email is slow" affects one person or the whole organisation.',
    },
    {
      id: 'kt_distinctions',
      label: 'Problem Analysis — Identified distinctions by comparing items that do NOT have the problem to those that do. Did the candidate find what is uniquely different about the affected case vs the unaffected case? KT\'s unique approach: the distinction is almost always where the root cause lies.',
      weight: 8,
      critical: false,
      category: 'cause_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_distinctions',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis: "Identify the problem using Kepner-Tregoe\'s unique approach of comparing items that do not have the problem to those that do." This is the pivotal step: after establishing WHAT/WHERE/WHEN/EXTENT for both IS and IS NOT, the candidate must identify what is unique to the affected case. The distinction is almost always where the root cause lies. Assessment criteria: (1) explicitly compares the working and non-working states after gathering IS/IS NOT data; (2) identifies a specific, testable distinction — the affected machine has Feature Update 23H2 while the unaffected one has 22H2, not a vague "different configuration"; (3) the distinction logically explains why the IS side has the problem and the IS NOT side does not; (4) uses the distinction to generate focused, testable hypotheses. A good example: "So the key distinction is: your office desktop has the issue, but your laptop at home does not. Both are on the same account and same Office version. The distinction is the machine itself and the network it connects from. That suggests either a local Outlook configuration or a network-level block specific to the office." A poor example: Never comparing working vs non-working conditions, treating the issue in isolation and missing the most efficient path to root cause.',
    },
    {
      id: 'kt_identify_changes',
      label: 'Problem Analysis — Identified specific changes that caused the problem. Did the candidate use clues from the IS/IS NOT distinctions to pinpoint what changed? KT emphasises that nearly all problems are caused by a change.',
      weight: 10,
      critical: false,
      category: 'cause_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'recent_changes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis: "Use clues to identify specific changes that caused the problem." KT\'s most powerful concept: problems are almost always caused by a change. The IS/IS NOT distinctions provide the clues about what changed. Adapted for service desk: the candidate must probe for changes methodically, not settle for "nothing changed." Assessment criteria: (1) actively investigates what changed using the clues from distinctions — "The distinction is that webmail works but desktop Outlook doesn\'t. That points to a change in the Outlook configuration or local network, not the mail server"; (2) probes specific change categories: updates, installations, configuration changes, password changes, network changes; (3) asks about changes the user might not think to mention — "Has IT pushed any updates recently?"; (4) correlates the timing of identified changes with the problem onset; (5) if no change is obvious, probes deeper — the user may not know about automatic changes (Windows Update, Group Policy, certificate renewal). A good example: "Since this started suddenly yesterday afternoon, let me ask specifically: did Windows install any updates? Was there a network change? Did anyone modify your account permissions? Did you install any new software or add-ins?" A poor example: Asking "Did anything change?" once, accepting "No" at face value, and moving on without probing further.',
    },
    {
      id: 'kt_generate_possible_causes',
      label: 'Problem Analysis — Created hypotheses about possible causes that explain all known facts. Did the candidate generate specific, testable possible causes grounded in the IS/IS NOT analysis — not random guesses?',
      weight: 8,
      critical: false,
      category: 'cause_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_generate_possible_causes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis: "Create and test hypotheses about possible causes to eliminate ones that don\'t support known facts." Adapted for service desk: the candidate generates hypotheses that are grounded in the evidence gathered so far — each possible cause must explain ALL the facts in the IS column and not contradict the IS NOT column. Assessment criteria: (1) possible causes are explicitly linked to evidence — "Based on the distinction that webmail works but desktop Outlook doesn\'t, and this started after Tuesday\'s update, possible causes are: (a) the update changed a network setting, (b) the update broke the Outlook profile, (c) the update is blocking Outlook in the firewall"; (2) causes are testable — each suggests a specific check that can confirm or eliminate it; (3) causes are specific — not vague; (4) the candidate considers multiple possibilities rather than jumping to one. A good example: "There are a few possible causes based on what we know: (1) the Work Offline toggle is accidentally enabled — quickest to check; (2) the Outlook profile is corrupted; (3) a recent Windows update changed network permissions. Let me check the simplest first." A poor example: Jumping straight to "Let me rebuild your Outlook profile" without generating and testing simpler hypotheses first.',
    },
    {
      id: 'kt_test_causes',
      label: 'Problem Analysis — Tested hypotheses to eliminate ones that do not support known facts. Did the candidate test possible causes in a logical order — most likely or easiest first — before implementing a fix?',
      weight: 10,
      critical: false,
      category: 'cause_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_test_causes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis: "Test hypotheses about possible causes to eliminate ones that don\'t support known facts." Each test is designed to confirm or eliminate a specific hypothesis — testing IS NOT the same as trying random fixes. Assessment criteria: (1) tests causes in a rational order — quickest, safest, most likely first; (2) each test targets a specific hypothesis — "If the Work Offline toggle is the cause, disabling it will immediately fix the issue"; (3) does not perform destructive or time-consuming tests before simple checks; (4) interprets results correctly — a negative result eliminates that cause and narrows the field; (5) adapts testing order based on results. A good example: "Let me start with the simplest test. I can see from the Outlook status bar it says Working Offline. Let me check the Work Offline toggle under the Send/Receive tab. If that is the issue, we can fix it immediately." A poor example: Jumping straight to "Let me recreate your Outlook profile" without checking the three-second fix of the Work Offline toggle first.',
    },
    {
      id: 'kt_most_probable_cause',
      label: 'Problem Analysis — Confirmed the true cause before taking action to fix it. Did the candidate arrive at a specific, evidence-supported root cause through systematic elimination, rather than guessing or trying fixes until one worked?',
      weight: 8,
      critical: false,
      category: 'cause_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_most_probable_cause',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis: "Confirm the true cause before taking action to fix it." The true cause is confirmed when it accounts for every fact in the IS column and none in the IS NOT column. Adapted for service desk: the candidate arrives at a specific, evidence-supported root cause through elimination, not guessing. Assessment criteria: (1) can state the true cause explicitly — "The cause is the Work Offline toggle being enabled, because disabling it immediately resolved the issue"; (2) the stated cause explains ALL observed symptoms, not just the main one; (3) the cause does not contradict any established IS NOT facts; (4) the cause was reached through systematic testing and elimination; (5) if the true cause cannot be identified, the candidate acknowledges this rather than inventing one. A good example: "The true cause is that Outlook was accidentally switched to Work Offline mode. This explains why: (a) Outlook shows Working Offline, (b) emails stay in Outbox, (c) webmail works fine, (d) network connectivity is normal, (e) disabling the toggle resolved it immediately." A poor example: "I think it was an Outlook glitch" — a vague, untestable, unverifiable explanation that does not identify root cause.',
    },
    {
      id: 'kt_verify_assumptions',
      label: 'Problem Analysis — Verified assumptions through direct evidence rather than accepting them as facts. Did the candidate test assumptions made during diagnosis — like "the user already tried that" or "nothing changed"?',
      weight: 6,
      critical: false,
      category: 'cause_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_verify_assumptions',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Verify Assumptions throughout the process: assumptions should be tested, not accepted. Adapted for service desk: the candidate does not take statements at face value. If the user says "I already restarted," the candidate checks uptime. If the user says "nothing changed," the candidate checks for updates. Assessment criteria: (1) identifies assumptions made during diagnosis — "I am assuming the user restarted, but let me verify"; (2) tests assumptions through direct evidence — checking event logs, running diagnostics, verifying settings; (3) does not accept "I already tried that" without verification; (4) adjusts diagnosis when an assumption proves false. A good example: "You mentioned you already tried restarting Outlook. Let me just check the system uptime to confirm... I can see uptime is 14 days, so Outlook has not been restarted recently. Let me try that first." A poor example: Accepting the user\'s claim that they "already tried everything" and skipping basic checks, potentially missing the simplest fix.',
    },
    {
      id: 'kt_confirm_root_cause',
      label: 'Problem Analysis — Demonstrated cause-and-effect: corrective action addresses the identified cause. Did the candidate confirm the root cause by showing that the fix predictably resolves the issue through a clear cause-and-effect relationship?',
      weight: 10,
      critical: false,
      category: 'verification',
      checkType: 'ai_criteria',
      checkTarget: 'kt_confirm_root_cause',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Confirm True Cause: "How can we demonstrate the cause-and-effect relationship? When corrective action is taken, how will results be checked?" The root cause is only confirmed when corrective action predictably resolves the issue. Adapted for service desk: the candidate must demonstrate that the fix resolves the problem because it addresses the root cause, not by coincidence. Assessment criteria: (1) there is a clear cause-and-effect story — "The toggle was set to Work Offline. Disabling it restored connectivity. Therefore the root cause was the toggle state."; (2) the fix was applied deliberately to test the cause hypothesis — not randomly; (3) the candidate can explain WHY the fix worked, not just THAT it worked; (4) the root cause is documented specifically. A good example: "I confirmed the root cause by checking the Outlook status bar — it showed Working Offline. I toggled it off, and immediately the status changed to Connected. I sent a test email which went through. The cause-and-effect is clear: the Work Offline setting was enabled, disabling it restored normal function." A poor example: "I fixed it" with no understanding of why the fix worked, or claiming a root cause that does not explain all symptoms.',
    },
    {
      id: 'kt_monitor_outcome',
      label: 'Problem Analysis — Monitored outcome after corrective action to confirm the fix stayed working. Did the candidate verify the fix immediately, check for side effects, and set expectations for monitoring?',
      weight: 6,
      critical: false,
      category: 'verification',
      checkType: 'ai_criteria',
      checkTarget: 'kt_monitor_outcome',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Monitor After Corrective Action: monitor the outcome to confirm the problem is truly resolved and no new problems have been introduced. Adapted for service desk: the candidate should confirm the fix is working immediately and set monitoring expectations. Assessment criteria: (1) immediately verifies the fix — "Try sending an email now. Did it go through?"; (2) checks for side effects — "Does everything else still work? Can you receive emails too?"; (3) sets monitoring expectations — "If the issue comes back, please call us. It could indicate a deeper issue."; (4) if not immediately verifiable, sets a clear monitoring plan with the user. A good example: "Okay, I have disabled Work Offline. Can you try sending a test email now? ... It went through? Great. Can you also check if you can receive a reply? ... All working. If it happens again, please call us back — it could be a recurring issue we need to investigate further." A poor example: Applying a fix and closing the ticket without confirming with the user.',
    },
    {
      id: 'kt_document_analysis',
      label: 'Problem Analysis — Documented the KT analysis in the ticket. Did the candidate record the IS/IS NOT findings, distinctions, changes, hypotheses tested, and confirmed root cause — not just the fix?',
      weight: 6,
      critical: false,
      category: 'verification',
      checkType: 'ticket_field',
      checkTarget: 'resolution',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Documentation: the analysis process should be recorded so the reasoning is recoverable. Adapted for service desk: the ticket note should capture the diagnostic journey, not just the outcome. Assessment criteria: (1) ticket documents symptoms and the IS/IS NOT boundary — what was happening vs what was not; (2) diagnostic steps and results are recorded; (3) root cause is stated explicitly, not just the fix; (4) resolution is linked to root cause — "Disabled Work Offline because it was stuck in that mode"; (5) documentation is sufficient for another technician to understand the reasoning. A good example: "Symptom: Outlook stuck in Work Offline mode. Webmail works, other devices work. Distinction: only this machine affected. Identified change: none reported. Tested: toggled Work Offline → immediate resolution. Root cause: Work Offline setting was enabled. Fix: disabled, confirmed test email sent and received. Monitor: advised user to call back if it reoccurs." A poor example: A ticket that says only "Fixed Outlook" with no diagnostic process documented.',

      // Auto-generated evidence handling — for kt_document_analysis which relies on ticketing
    },

    // ════════════════════════════════════════════════════════════════
    // DISCIPLINE 3: DECISION ANALYSIS
    //   When multiple solutions are possible, identify objectives and
    //   criteria for evaluation. Distinguish mandatory requirements
    //   from desirable ones. Compare alternatives against criteria.
    //   Consider risks before committing to a final choice.
    // ════════════════════════════════════════════════════════════════
    {
      id: 'kt_evaluate_alternatives',
      label: 'Decision Analysis — Compared alternatives against criteria and considered risks before committing to a final choice. Did the candidate consider multiple approaches and evaluate which was best, rather than implementing the first fix that came to mind?',
      weight: 8,
      critical: false,
      category: 'decision_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_evaluate_alternatives',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Decision Analysis: "Identify scope and gain consensus by focusing on identifying objectives, then choices, and finally on risks before committing to a final choice. Use simple-but-robust techniques for comparing performance of alternatives. Consider risks associated with alternatives." Adapted for service desk: when multiple valid approaches exist, the candidate compares options, evaluates trade-offs, and considers adverse consequences rather than picking the first fix. Assessment criteria: (1) when multiple fix options exist, explicitly considers more than one — "I could either toggle off Work Offline, run the Microsoft Support Assistant, or rebuild the profile"; (2) the chosen approach is justified — why this option over others; (3) considers adverse consequences — "If I delete the profile, they will lose cached emails. Let me try non-destructive options first"; (4) evaluates based on relevant criteria: speed, safety, reversibility, customer impact. A good example: "There are a few ways to fix this. The safest and fastest is to simply disable the Work Offline toggle. If that doesn\'t work, we can run the Microsoft Support and Recovery Assistant which is non-destructive. Only if both fail would I consider rebuilding the profile, since that means re-entering account details and losing cached data." A poor example: Immediately choosing the most destructive option without considering simpler alternatives first.',
    },
    {
      id: 'kt_da_identify_objectives',
      label: 'Decision Analysis — Identified objectives and criteria that will be used to evaluate choices, including clear measures of success. Did the candidate establish what a good outcome looks like before choosing a solution path?',
      weight: 6,
      critical: false,
      category: 'decision_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_da_identify_objectives',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Decision Analysis: "Identify criteria that will be used to evaluate choices, including clear measures of success." Adapted for service desk: the candidate should have a sense of what a good outcome looks like — what the fix needs to achieve — before selecting an approach. Assessment criteria: (1) establishes what success looks like — "The goal is to get Outlook sending and receiving again without losing data"; (2) identifies constraints — "We need to avoid downtime, preserve cached emails, and not disrupt other users"; (3) criteria are explicit enough to compare options against; (4) communicates the objective to the customer to gain alignment. A good example: "The objective here is to get your email working again without losing any data and with minimal downtime. So any fix we try should meet those criteria — let me start with the least disruptive option." A poor example: Having no clear goal beyond "fix it" and trying random approaches without evaluating whether they meet the user\'s needs.',
    },
    {
      id: 'kt_da_mandatory_want',
      label: 'Decision Analysis — Distinguished mandatory criteria from desirable ones and understood how much influence non-mandatory criteria would have. Did the candidate separate what is essential from what is merely nice-to-have?',
      weight: 6,
      critical: false,
      category: 'decision_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_da_mandatory_want',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Decision Analysis: "Understand which criteria are mandatory and which are not, and how much influence non-mandatory criteria will have." Adapted for service desk: the candidate implicitly or explicitly distinguishes between what is essential (must fix, must not break) vs what is desirable (speed, convenience, completeness). Assessment criteria: (1) treats certain constraints as non-negotiable — "We must not lose data, and we must not disable security"; (2) treats other factors as trade-offs — "Fast would be nice, but safety is more important"; (3) does not sacrifice mandatory criteria for convenience; (4) explains the trade-off reasoning when choosing between options. A good example: "My mandatory criteria are: preserve all data, maintain security, and get email working. The desirable criteria are: fix it quickly, preferably without a reboot. The quickest option — toggling Work Offline — meets all mandatory criteria and is also fast, so that is our best first attempt." A poor example: Sacrificing data integrity or security for speed, or treating all criteria as equally important.',
    },
    {
      id: 'kt_da_consider_risks',
      label: 'Decision Analysis — Considered risks associated with alternatives before committing to a final choice. Did the candidate evaluate what could go wrong with each option and plan accordingly?',
      weight: 8,
      critical: false,
      category: 'decision_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_da_consider_risks',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Decision Analysis: "Consider risks associated with alternatives." Before committing to a final choice, the candidate should think through adverse consequences. Adapted for service desk: the candidate considers the downside of each approach and communicates it to the customer. Assessment criteria: (1) identifies risks of each approach — "If I rebuild the profile, the user will lose cached emails and need to reconfigure their account"; (2) the chosen approach is selected partly because it has the lowest risk profile; (3) communicates risks to the customer transparently; (4) has a backup plan if the chosen approach fails or causes issues. A good example: "Toggling Work Offline has the lowest risk — it takes two seconds and if it doesn\'t work, no harm done. Running the Support Assistant is also low risk but takes longer. Rebuilding the profile is the most disruptive — the user could lose cached data. Let me try in order of lowest risk first." A poor example: Choosing a high-risk option without acknowledging or communicating the risks, or having no fallback plan.',
    },

    // ════════════════════════════════════════════════════════════════
    // DISCIPLINE 4: POTENTIAL PROBLEM ANALYSIS
    //   Consider what might go wrong with future actions. Brainstorm
    //   things that could impact success, prioritise, identify and
    //   prevent possible causes, prepare contingent actions with triggers.
    // ════════════════════════════════════════════════════════════════
    {
      id: 'kt_ppa_identify_risks',
      label: 'Potential Problem Analysis — Brainstormed specific things that could impact the success of a plan or action, and put them in priority order. Did the candidate proactively identify what could go wrong?',
      weight: 6,
      critical: false,
      category: 'potential_problem_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_ppa_identify_risks',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Potential Problem Analysis: "Brainstorm a list of things that could impact the success of a plan or action. Put the list in priority order so action can be taken on the right thing at the right time." Adapted for service desk: the candidate proactively identifies risks or potential complications with a proposed fix or plan. Assessment criteria: (1) identifies specific things that could go wrong — "If we disable the add-in, it might disable other Outlook features too"; (2) prioritises risks — which ones are most likely or most serious; (3) does not proceed blindly with a fix without considering potential negative outcomes; (4) communicates identified risks to the customer proactively. A good example: "Before I proceed with this fix, let me flag a couple of risks. First, disabling this add-in might also remove some other functionality you use. Second, if the fix doesn\'t work, we will have to try the more disruptive option of rebuilding the profile. Are you okay to proceed with that understanding?" A poor example: Blindly applying changes without considering what could go wrong, or ignoring potential side effects.',
    },
    {
      id: 'kt_ppa_preventative',
      label: 'Potential Problem Analysis — Identified and prevented possible causes for each potential problem. Did the candidate take proactive steps to prevent issues before applying a fix?',
      weight: 6,
      critical: false,
      category: 'potential_problem_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_ppa_preventative',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Potential Problem Analysis: "Identify and prevent possible causes for each potential problem." Adapted for service desk: the candidate takes preventive action — backing up configuration before changes, setting restore points, noting current settings, or taking other precautions. Assessment criteria: (1) takes preventive steps before making changes — "Let me note your current Outlook profile settings before we make any changes"; (2) backs up or preserves the current state so it can be restored if needed; (3) asks permission before making changes that could have side effects; (4) identifies what could cause the fix to fail and addresses it preemptively. A good example: "Before I disable the add-in, let me note the current Outlook settings. That way if anything goes wrong, I can restore it to exactly how it was. I am also going to make sure we have a backup of your OST file first." A poor example: Making changes without any precautions or backup, risking data loss or configuration issues.',
    },
    {
      id: 'kt_ppa_contingent',
      label: 'Potential Problem Analysis — Prepared contingent actions to minimise effects if problems happen, along with triggers to ensure those actions happen only when needed. Did the candidate have a backup plan with clear triggers?',
      weight: 6,
      critical: false,
      category: 'potential_problem_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_ppa_contingent',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Potential Problem Analysis: "Prepare actions to minimize effects if problems happen along with triggers to ensure those actions happen only when needed." Adapted for service desk: the candidate has a clear backup plan if the primary fix does not work, with specific conditions that trigger escalation or alternative action. Assessment criteria: (1) has a clear escalation path or fallback plan — "If this doesn\'t work, I will escalate to Level 2 with full context"; (2) defines specific triggers for contingency — "If the fix doesn\'t work within 15 minutes, I will escalates"; (3) communicates the contingency plan to the customer so they know what to expect; (4) does not treat the first fix attempt as the only option. A good example: "Let me try toggling the Work Offline setting. If that resolves it immediately, we are done. If not, I will run the Microsoft Support and Recovery Assistant. If that also fails, I will need to escalate to our senior team with full context. I will update you after each step." A poor example: Having no backup plan and being stuck when the first fix does not work, or escalating without clear triggers.',
    },

    // ════════════════════════════════════════════════════════════════
    // DISCIPLINE 5: POTENTIAL OPPORTUNITY ANALYSIS
    //   Identify and leverage future opportunities using the same
    //   structured approach — spotting potential improvements,
    //   preventive measures, or value-add opportunities.
    // ════════════════════════════════════════════════════════════════
    {
      id: 'kt_poa_opportunity',
      label: 'Potential Opportunity Analysis — Identified and leveraged future opportunities to prevent recurrence or improve outcomes. Did the candidate proactively suggest improvements, preventive measures, or value-add actions beyond the immediate fix?',
      weight: 4,
      critical: false,
      category: 'potential_opportunity_analysis',
      checkType: 'ai_criteria',
      checkTarget: 'kt_poa_opportunity',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Potential Opportunity Analysis: "A structured process for identifying and leveraging future opportunities." Adapted for service desk: the candidate identifies ways to prevent the issue from recurring, improve the customer\'s setup, or add value beyond the immediate fix. Assessment criteria: (1) suggests preventive measures — "To stop this happening again, let me set up a monitoring alert on your mailbox"; (2) identifies opportunities to improve the customer\'s setup proactively — "While I am here, I noticed your Outlook is on an older version. Would you like me to schedule an upgrade?"; (3) the suggestion is specific and actionable, not generic; (4) the candidate communicates the opportunity clearly and asks for permission rather than assuming. A good example: "Now that the immediate issue is resolved, I recommend we look at why the Work Offline toggle keeps getting enabled. I can set up a scheduled task to check the status periodically and alert us if it changes. Would you like me to do that?" A poor example: Fixing only the immediate issue with no thought to prevention or improvement, or making changes the customer did not ask for without explaining the benefit.',
    },
  ],
};
