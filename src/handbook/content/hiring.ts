import type { HandbookPage } from "../types";

// Recruiting, onboarding, reviews and leaving. Labour-law points follow the Labour Act 2074 and the Social
// Security Act; amounts and limits change, so they're marked for confirmation with the accountant or a lawyer.

export const HIRING: HandbookPage[] = [
  {
    slug: "hiring-process",
    section: "hiring",
    title: "Hiring: the process, step by step",
    summary: "From a vacancy to a signed offer: the same fair process for every role and every location.",
    audience: ["owner", "ops-manager", "shop-manager"],
    minutes: 6,
    version: 1,
    related: ["hiring-job-descriptions", "hiring-interviews", "hiring-new-joiner-setup"],
    body: `A national company hires hundreds of people. The same process everywhere means good people, fair treatment, and no hiring by who-knows-whom.

## The steps
| Step | Who | What |
|---|---|---|
| 1. Need | Shop or ops manager | Why the role is needed: roster gaps, a new shop, growth. Check the budget. |
| 2. Approval | Owner (or ops manager for shop roles within budget) | Yes or no, the pay range, start date. |
| 3. Job ad | Hiring manager | From the job description page; pay range; how to apply; closing date. |
| 4. Advertise | Hiring manager | Shop window, our social media, job sites, referrals from the team. |
| 5. Shortlist | Hiring manager | Against the must-haves only. Reply to everyone. |
| 6. Interview | Hiring manager + one other | The interview guide and scorecard for the role. |
| 7. Practical | Hiring manager | A trial task: a paid trial shift on the floor, a packing test, a sample reply, a costing exercise. |
| 8. References | Hiring manager | Two references, at least one a past employer. Check identity documents. |
| 9. Offer | Owner approves | Written offer and contract: role, pay, hours, location, probation, start date. |
| 10. Setup | Manager + owner | The new joiner setup checklist, before day 1. |

## Rules for fair hiring
- Same questions and scorecard for every candidate for a role.
- Decide on the scorecard, not on liking someone.
- No discrimination by caste, ethnicity, religion, gender, marital status, disability or region.
- Family and friends of staff can apply, but they're interviewed by someone else and can't report to their relative.
- Keep applications private; delete unsuccessful candidates' details after 6 months.

> **Why:** the best predictor of a great company is great people, chosen consistently. A bad hire costs months; a careful process costs days.`,
  },
  {
    slug: "hiring-job-descriptions",
    section: "hiring",
    title: "Job descriptions and job ads",
    summary: "Ready-to-use descriptions for every job, with must-haves and a template ad.",
    audience: ["owner", "ops-manager", "shop-manager"],
    minutes: 7,
    version: 1,
    related: ["hiring-process", "job-cashier", "job-warehouse", "job-care", "job-shop-manager"],
    body: `Each job's full page (Your job section) has its purpose, responsibilities and measures. Use this page for the ad.

## Must-haves and nice-to-haves
| Job | Must have | Nice to have |
|---|---|---|
| Cashier / sales associate | Friendly with customers; honest; basic maths; smartphone use; Nepali and some English | Retail or fashion experience; local area knowledge |
| Warehouse & fulfilment | Careful and accurate; physically fit for lifting; reliable time-keeping | Warehouse or courier experience; scanner use |
| Customer care | Clear written and spoken Nepali and English; patient; computer use | Call centre or e-commerce support |
| Shop manager | 2+ years in retail with people to manage; cash handling; leading a team | Fashion retail; opening a shop; targets |
| Operations manager | 5+ years in multi-site retail or logistics operations; leading managers; data | Chain retail in Nepal; warehouse management |
| Buyer / merchandiser | Product sense for classic clothing; numbers (margin, stock cover); supplier dealing | Garment sourcing in Nepal, India or China; production |
| Accountant | BBS/BBA in accounting or CA inter; Nepal VAT, TDS and SSF; bank reconciliation | Retail accounting; audit experience |
| Marketing | Writing in English and Nepali; social media; photos and styling eye | Ads (Meta, TikTok); analytics |

## A job ad template
**Asson is hiring: [Job] in [Location]**

Asson makes classic clothing in quality fabric at fair prices, with shops and delivery across Nepal. We're growing, and we're looking for a [job] who [purpose of the job in one line].

**You'll:** [3–5 responsibilities from the job page]

**You have:** [the must-haves]

**We offer:** pay of Rs. [range] a month, SSF, festival allowance, training from day one with a clear path to grow, staff discount, and a team that does things properly.

**Apply** by [date]: send your CV and a short note on why Asson to [email / WhatsApp number / in person at the shop].

> **Tip:** say the pay range. It saves everyone's time and attracts people who are serious.`,
  },
  {
    slug: "hiring-interviews",
    section: "hiring",
    title: "Interview guide and scorecard",
    summary: "The questions to ask for each job, what good answers sound like, and how to score.",
    audience: ["owner", "ops-manager", "shop-manager"],
    minutes: 7,
    version: 1,
    related: ["hiring-process", "hiring-job-descriptions"],
    body: `## The interview (30–45 minutes)
1. Welcome; explain Asson and the job (5 min).
2. Their story: past work, why this job (5 min).
3. The questions for the role, below (20 min). Ask for real examples: "Tell me about a time when…".
4. Their questions (5 min).
5. Next steps and when they'll hear (always keep this promise).

## Questions for everyone
- Tell me about a time you made a mistake at work. What did you do?
- What does good customer service mean to you? Give an example you received or gave.
- Tell me about a time you saw a colleague doing something wrong. What did you do?

## Questions by job
| Job | Ask |
|---|---|
| Cashier | A customer insists they paid by QR but you see no payment. What do you do? / What would you do with a quiet hour in the shop? |
| Warehouse | You can't find an item on the pick list. What do you do? / How do you make sure you don't make mistakes on repetitive work? |
| Care | A customer is angry their parcel is late and is shouting. Walk me through your reply. / Write a short reply to this complaint (practical). |
| Shop manager | Your shop is 20% behind target mid-month. What do you do? / A good cashier keeps arriving late. How do you handle it? / A cash shortage appears two days running on one till. |
| Ops manager | Three shops have falling scores. How do you decide where to go first? / How do you get 20 shop managers to follow the same standard? |
| Buyer | How would you decide how many of each size to buy for a new shirt? / A best seller has a 25% margin. What do you do? |
| Accountant | The bank shows a deposit Rs. 2,000 less than the shop recorded. Steps? / How do you handle input VAT on a bill without a PAN? |
| Marketing | Show us three things you'd change on our product pages. / How would you measure whether a TikTok campaign worked? |

## Scorecard (each 1–4)
| Area | 1 | 4 |
|---|---|---|
| Honesty and integrity | Blames others, vague | Owns mistakes, specific |
| Customer focus | Talks about rules | Talks about the customer's problem |
| Accuracy and care | Careless answers | Checks, explains how they avoid errors |
| Role skills | Can't answer the role questions | Clear, practical, experienced |
| Learning and attitude | Fixed, defensive | Curious, wants to grow |

Hire only with no 1s and an average of 3 or more. **Honesty below 3 is a no**, whatever else.`,
  },
  {
    slug: "hiring-new-joiner-setup",
    section: "hiring",
    title: "New joiner setup (for managers and the owner)",
    summary: "Everything to do before and on a new person's first day, in the system and in person.",
    audience: ["owner", "ops-manager", "shop-manager"],
    minutes: 5,
    version: 1,
    open: [{ label: "Team & access", href: "/admin/team" }, { label: "Team onboarding", href: "/admin/handbook/onboarding" }],
    related: ["onboarding-new-joiner", "sys-team-access", "hiring-reviews"],
    body: `## Before day 1
- [ ] Signed contract and offer on file; copies of citizenship and PAN; bank account details; emergency contact.
- [ ] **Team & access** (owner): add them with their job and the locations they work at. They get a one-time link to set their password.
- [ ] **Pay terms** (owner/accountant): basic salary and allowances; SSF registration details.
- [ ] Roster: their first two weeks published, overlapping with an experienced colleague (their **buddy**).
- [ ] Uniform, name badge, locker; the shop's keys only if their job needs them.
- [ ] Announcement to the team: who's joining, when, and who their buddy is.

## Day 1
- [ ] Welcome, a tour, introductions, safety (exits, fire, first aid), where things are.
- [ ] They set their password from the link; check they can sign in at /admin/login on the shop device and their phone (install Asson Admin).
- [ ] Show them Today, My time (clock in) and the Handbook: their path is ready.
- [ ] Managers and cashiers: set their **approval PIN** (managers only) on My approval PIN.
- [ ] First pages of their path together: Welcome, How the company runs.
- [ ] Their buddy shows them the job for the rest of the day.

## Days 2–30
- [ ] Their job page's 30-day plan.
- [ ] Check **Team onboarding** weekly: reading path and procedures signed.
- [ ] Skills sign-off: watch them do each skill on their job page.
- [ ] Check-ins at the end of week 1, week 2 and day 30 (see Reviews).

> **Rule:** nobody works a till alone, ships orders alone or approves anything before they've signed the procedures for it.`,
  },
  {
    slug: "onboarding-new-joiner",
    section: "hiring",
    title: "Your first 30 days at Asson",
    summary: "What to expect, what's expected of you, and how to get help, for every new joiner.",
    audience: "all",
    minutes: 4,
    version: 1,
    related: ["using-the-handbook", "welcome", "sys-training"],
    body: `Welcome. Here's how your first month works, whatever your job.

## Week 1: learn and watch
- You'll have a **buddy**: an experienced colleague you shadow and ask anything.
- Read the first part of your Handbook path every day (it's on the Handbook home page). Mark each page read and answer its questions.
- Sign the procedures for your job in Training.
- Do the job alongside your buddy.

## Weeks 2–3: do it with support
- Do the job yourself with your buddy or manager checking.
- Your manager watches you do each skill on your job page and signs it off.
- Ask questions. Nobody expects you to know everything yet.

## Week 4: on your own
- Finish your Handbook path and all your procedures.
- Your 30-day check-in with your manager: how it's going, what's hard, what's next.

## How to get help
| Question | Ask |
|---|---|
| How do I do this task? | Your buddy, then the Handbook (search it) |
| Something's broken | Report it in Issues |
| Pay, leave, hours | Your manager |
| Something feels wrong (unsafe, unfair, dishonest) | Your manager, or the owner directly |

## Probation
Your first months are probation (your contract says how long). It's for both of us: you see if Asson is right for you, we see if you're right for the job. You'll have reviews along the way, so there are no surprises.`,
  },
  {
    slug: "hiring-reviews",
    section: "hiring",
    title: "Check-ins, probation and performance reviews",
    summary: "How we give feedback, review probation, run yearly reviews, and handle poor performance fairly.",
    audience: ["owner", "ops-manager", "shop-manager"],
    minutes: 6,
    version: 1,
    related: ["hiring-new-joiner-setup", "hiring-leaving", "conduct"],
    body: `## Check-ins in the first months
| When | Talk about |
|---|---|
| End of week 1 | Settling in, buddy, anything confusing |
| End of week 2 | Skills signed off so far, what's hard |
| Day 30 | Handbook path and procedures done? Skills? Strengths, one thing to improve |
| Day 60 | Progress on the improvement; measures for their job |
| End of probation | Confirm, extend (once, with a clear reason and plan) or end |

## The yearly review (and a short mid-year one)
Before the meeting, the manager gathers facts from the system: their measures (from the job page), checklists, cash differences, sales and commission, care satisfaction, attendance, training signed.

In the meeting:
1. Their view first: what went well, what didn't.
2. The facts, good and bad.
3. Rate each area: **Exceeds**, **Meets**, **Needs to improve**.
4. Two or three goals for next year, with how they'll be measured.
5. Their development: training, a bigger role, what they want.

## When performance isn't good enough
1. **Talk early**: specific facts, what good looks like, support offered, a date to review (2–4 weeks).
2. **Written improvement plan** if it doesn't improve: goals, support, review dates.
3. **Written warning** if it still doesn't improve, with HR or the owner present.
4. Then a decision, following the Labour Act's process.

Misconduct (theft, violence, harassment, data misuse) follows the disciplinary process directly: investigate, hear their side, decide, record.

> **Why:** feedback that comes early and specifically is a kindness. A review that surprises someone means the manager failed earlier.`,
  },
  {
    slug: "hiring-leaving",
    section: "hiring",
    title: "When someone leaves",
    summary: "The leaver checklist: access removed the same day, final pay, hand-over and exit interview.",
    audience: ["owner", "ops-manager", "shop-manager", "accountant"],
    minutes: 4,
    version: 1,
    open: [{ label: "Team & access", href: "/admin/team" }],
    related: ["sys-team-access", "sys-payroll"],
    body: `## The checklist
- [ ] **Access removed in Team & access on their last day** (owner). Their sessions end immediately on every device. If they're leaving on bad terms, remove access first, then tell them.
- [ ] Approval PIN no longer works (it ends with their access).
- [ ] Open till shift closed and counted; open items handed over (cases, issues, transfers).
- [ ] Keys, uniform, badge, equipment returned.
- [ ] Future roster shifts removed or reassigned; leave balances settled.
- [ ] Final pay: salary to the last day, unused leave as the Labour Act requires, festival allowance if due, SSF and TDS handled; payslip on file.
- [ ] Experience letter if they ask.
- [ ] Exit interview: why they're leaving, what we should change. Write it down; the owner reads every one.

> **Note:** settling a leaver's tax mid-year is done in payroll at the year-end check for now. The system handles the leaver's final month like any other month.

> **Rule:** never leave a leaver's account active "for a few days". Access ends on the last day, always.`,
  },
  {
    slug: "conduct",
    section: "hiring",
    title: "Code of conduct and service standards",
    summary: "How we treat customers, each other, money, stock and information. It applies to everyone, including the owner.",
    audience: "all",
    minutes: 6,
    version: 1,
    related: ["how-we-run", "sop-security", "hiring-reviews"],
    body: `## With customers
- Greet every customer within a minute of them coming in. Smile, make eye contact, offer help without pressure.
- Be honest about fabric, fit and stock. If you don't know, find out.
- Treat every customer the same, whatever they're wearing or wherever they're from.
- Keep promises: if you say you'll call back at 4, call back at 4.
- Never argue. Solve the problem, or bring in your manager.

## With each other
- Respect: no shouting, insults, gossip, bullying or harassment of any kind, in person or online.
- Sexual harassment is never acceptable. Report it to the owner directly; reports are taken seriously and handled confidentially.
- Help new colleagues; share what you know.
- Disagree openly and politely; once decided, follow the decision.

## With money and stock
- Every sale through the till. Every discount with its reason. Every rupee counted honestly.
- Staff purchases go through the till with the staff discount, rung up by someone else.
- Never take, "borrow" or move stock or cash outside the system.
- Report any loss, shortage or mistake straight away. Honest mistakes are forgiven; hiding them isn't.

## With information
- Customer and company information stays in the system. No screenshots, copies or sharing.
- Don't speak for Asson on social media or to the press. Send questions to the owner.
- Salaries are private.

## Time and appearance
- On time for every shift; tell your manager before, not after, if you'll be late.
- Clean uniform, tidy appearance, name badge on.
- Phones away on the shop floor except for work.

## Speaking up
If you see something wrong (dishonesty, unsafe conditions, harassment, data misuse), tell your manager or the owner directly. Nobody will be punished for raising a concern honestly.

> **Rule:** theft, fraud, violence, harassment and misuse of customer data are serious misconduct and can lead to dismissal.`,
    quiz: [
      { q: "You want to buy a shirt with your staff discount. How?", options: ["Ring it up yourself", "A colleague rings it up through the till with the staff discount", "Take it and pay later"], answer: 1, why: "Staff purchases go through the till, rung up by someone else, so there's no question of honesty." },
      { q: "You notice you gave a customer Rs. 500 too much change yesterday. What do you do?", options: ["Nothing, the shift is closed", "Tell your manager now", "Take it from the next sale"], answer: 1, why: "Honest mistakes are forgiven; hiding them isn't. Tell your manager straight away." },
    ],
  },
];
