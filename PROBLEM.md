# Problem statement (verbatim)

Develop a smart, interconnected healthcare management platform designed to help elderly individuals manage their daily medications, medical appointments, and healthcare routines while keeping their family members and caretakers informed.

The platform should provide a shared ecosystem where elderly individuals, caretakers, and family members can access and manage an elderly person's healthcare profile through secure, passcode-based access.

Authorized members should be able to view, add, edit, and manage medication schedules, track adherence, and monitor upcoming doctor appointments.

The system should proactively send email reminders for missed medications, upcoming doses, and medical appointments, ensuring that important healthcare routines are never overlooked.

The challenge is to go beyond a basic reminder application. Think creatively and develop innovative ways make elderly care smarter, more accessible, reliable, and collaborative, while ensuring that elderly individuals remain at the centre of their own healthcare decisions.

## Evaluation (automated code assessment on the platform)

- Code Quality
- Security
- Efficiency
- Testing
- Accessibility
- Problem Statement Alignment
- Google Services usage

Only the **final submission** score for the phase counts (not the best attempt).

## Requirement → where it's handled

| Requirement | Feature |
|---|---|
| Shared ecosystem, passcode-based access | F2 care circles (code + passcode, lockout) |
| Elder, caretakers, family (+ doctors) | F2 role-based onboarding, permissions matrix |
| View/add/edit medication schedules | F3 |
| Track adherence | F3 Today view + adherence panel |
| Monitor upcoming appointments | F4 |
| Email reminders: upcoming, missed, appointments | F5 (+ escalation, refills) |
| Smarter / more accessible / reliable / collaborative | Escalation ladder, Gemini assist, passkeys, large text + read-aloud, activity log, QStash + cron redundancy |
| Elder at the centre | Elder owns + claims circle, approves roles, sees every change, confirms AI drafts |
