import { requirePermission } from "@/lib/auth";
import { teamList } from "@/lib/team";
import { getLocations } from "@/lib/stock";
import { defaultJob, effectivePermissions, jobOf, JOBS, TWO_FACTOR_ROLES, type StaffRole } from "@/lib/permissions";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { AccessEditor, AddMember, MemberActions } from "@/components/admin/team-forms";
import { StaffLocations } from "@/components/admin/staff-locations";
import { TwoFactorControls } from "@/components/admin/team-two-factor";

export const metadata = { title: "Team & access" };

export default async function TeamPage() {
  const me = await requirePermission("team.manage");
  const [team, locations] = await Promise.all([teamList(), getLocations({ includeInactive: false })]);
  const locs = locations.map((l) => ({ id: l.id, name: l.name }));
  const counts = JOBS.map((j) => ({ label: j.label, n: team.filter((m) => (m.job ?? defaultJob(m.role as StaffRole)) === j.key).length })).filter((c) => c.n);
  return (
    <>
      <PageHeader title="Team & access" description="Everyone who can sign in to the staff side, what their job lets them see, and where they work. Each person signs in with their own login; nobody shares the owner's." />
      <Card title="Add a team member">
        <AddMember locations={locs} />
      </Card>
      <Card title={`Team (${team.length})`} className="mt-4" action={<span className="hidden text-[12.5px] text-muted md:block">{counts.map((c) => `${c.n} ${c.label.toLowerCase()}`).join(" · ")}</span>}>
        <ul className="divide-y divide-line">
          {team.map((m) => {
            const job = m.job ?? defaultJob(m.role as StaffRole);
            // no job yet: show their real (classic) access as the closest job plus the differences, so saving changes nothing by surprise
            const classic = m.job ? null : effectivePermissions(m.role as StaffRole, null);
            const jobPerms = jobOf(job)!.permissions as string[];
            const add = classic ? classic.filter((p) => !jobPerms.includes(p)) : m.add;
            const remove = classic ? jobPerms.filter((p) => !(classic as string[]).includes(p)) : m.remove;
            return (
              <li key={m.id} className="grid gap-4 px-5 py-4 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <p className="font-medium">{m.name}{m.id === me.id && <span className="text-[12px] font-normal text-muted"> (you)</span>}</p>
                  <p className="break-all text-[12.5px] text-muted">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.invitePending && <Pill tone="warn">Invite not used yet</Pill>}
                    {m.hasPin && <Pill tone="neutral">Approval PIN set</Pill>}
                    {m.twoFactorOn ? <Pill tone="success">Two-step on</Pill> : (TWO_FACTOR_ROLES.includes(m.role as StaffRole) || m.twoFactorRequired) ? <Pill tone="warn">Two-step required, not set up</Pill> : null}
                    {!m.job && m.role !== "ADMIN" && <Pill tone="neutral">Classic {jobOf(job)?.label.toLowerCase()}</Pill>}
                  </div>
                </div>
                <div className="lg:col-span-5"><AccessEditor m={{ id: m.id, name: m.name, phone: m.phone, job, add, remove }} isMe={m.id === me.id} canMakeOwner={me.role === "ADMIN"} /></div>
                <div className="space-y-2 lg:col-span-4">
                  {m.role === "ADMIN" ? <p className="text-[13px] text-muted">Every location (owner)</p> : <StaffLocations userId={m.id} all={m.all} assigned={m.storeIds} locations={locs} editable />}
                  {m.id !== me.id && <MemberActions id={m.id} name={m.name} phone={m.phone} />}
                  <TwoFactorControls id={m.id} name={m.name} on={m.twoFactorOn} required={m.twoFactorRequired} byLevel={TWO_FACTOR_ROLES.includes(m.role as StaffRole)} isMe={m.id === me.id} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="mt-4 text-[12.5px] text-muted">A person&apos;s job decides what they see in the menu and which pages and actions they can use; fine-tuning adds or removes single areas for one person. Discount limits and approvals follow their level (owner, manager, cashier). Managers and owners always use two-step sign-in (a code from their phone after the password); you can require it for anyone else. Every change is in the Activity log.</p>
    </>
  );
}
