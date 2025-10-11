import { UpcomingList } from "../components/bookings/UpcomingList";
import { AssessmentsSection } from "../components/assessments/AssessmentsSection";
import { ContinueChatCard } from "../components/chat/ContinueChatCard";
import { TimezonePicker } from "../components/shared/TimezonePicker";

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6 grid grid-cols-12 gap-6">
      <section className="col-span-12 lg:col-span-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--brand-600)]" />
          <div>
            <div className="font-semibold">Hi, there</div>
            <div className="text-sm text-[var(--muted)]">
              Times shown in your timezone.
            </div>
          </div>
        </div>

        <UpcomingList />
        <AssessmentsSection />
        <ContinueChatCard />
      </section>

      <aside className="col-span-12 lg:col-span-4 space-y-6 lg:sticky lg:top-6 h-fit">
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-4 bg-[var(--card)]">
          <div className="font-medium mb-2">Today</div>
          <div className="text-sm text-[var(--muted)]">No events today.</div>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-4 bg-[var(--card)]">
          <TimezonePicker />
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] p-4 bg-[var(--card)]">
          <div className="font-medium mb-2">Help & Privacy</div>
          <p className="text-sm text-[var(--muted)]">
            This platform is not for emergencies. If you're in crisis, call
            your local hotline.
          </p>
        </div>
      </aside>
    </div>
  );
}
