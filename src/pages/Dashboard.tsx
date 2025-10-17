import { UpcomingList } from "../components/bookings/UpcomingList";
import { AssessmentsSection } from "../components/assessments/AssessmentsSection";
import { ContinueChatCard } from "../components/chat/ContinueChatCard";
import { TimezonePicker } from "../components/shared/TimezonePicker";
import { useAuth } from "../lib/auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut } from "lucide-react";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { motion } from 'framer-motion';
import MotionSection from "../components/MotionSection";
import { fadeInUp, springMd } from "../lib/anim";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center gap-3">
              <img src="/logo-blue-blob.jpg" alt="Huggys logo" className="h-20 w-20 rounded-full shadow-sm" />
              <h1 className="text-xl font-semibold text-gray-900">
                Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {user?.email}
              </span>
              <LanguageSwitcher />
              <button
                onClick={() => navigate("/settings")}
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-2 rounded-md transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1200px] px-6 py-6 grid grid-cols-12 gap-6">
      <MotionSection as="section" className="col-span-12 lg:col-span-8 space-y-6" variant="fade">
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--brand-600)]" style={{ animation: 'float 3s ease-in-out infinite' }} />
          <div>
            <div className="font-semibold">Hi, there</div>
            <div className="text-sm text-[var(--muted)]">
              Times shown in your timezone.
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} transition={springMd}>
          <UpcomingList />
        </motion.div>
        <motion.div variants={fadeInUp} transition={springMd}>
          <AssessmentsSection />
        </motion.div>
        <motion.div variants={fadeInUp} transition={springMd}>
          <ContinueChatCard />
        </motion.div>
      </MotionSection>

      <MotionSection as="aside" className="col-span-12 lg:col-span-4 space-y-6 lg:sticky lg:top-6 h-fit" variant="fadeUp" delay={0.1}>
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
      </MotionSection>
    </div>
    </div>
  );
}
