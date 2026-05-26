import { WorkerCalendarView } from "@/components/WorkerCalendarView";

export default async function WorkerCalendarPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-5">My Calendar</h1>
      <WorkerCalendarView />
    </div>
  );
}
