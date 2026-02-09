"use client";

import { useState, useMemo } from "react";
import "./PMCalendar.css";

interface CalendarSchedule {
  id: string;
  name: string;
  nextScheduledDate: string | null;
  status: string;
  asset: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
}

interface PMCalendarProps {
  schedules: CalendarSchedule[];
}

export default function PMCalendar({ schedules }: PMCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { calendarDays, monthName, year } = useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const firstDayOfWeek = monthStart.getDay();
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - firstDayOfWeek);

    const lastDayOfWeek = monthEnd.getDay();
    const calendarEnd = new Date(monthEnd);
    calendarEnd.setDate(calendarEnd.getDate() + (6 - lastDayOfWeek));

    const days: Date[] = [];
    const current = new Date(calendarStart);
    while (current <= calendarEnd) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return {
      calendarDays: days,
      monthName: monthStart.toLocaleString("default", { month: "long" }),
      year: monthStart.getFullYear(),
    };
  }, [currentDate]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, CalendarSchedule[]>();

    schedules.forEach((schedule) => {
      if (!schedule.nextScheduledDate || schedule.status !== "ACTIVE") return;

      const date = new Date(schedule.nextScheduledDate);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split("T")[0];

      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(schedule);
    });

    return map;
  }, [schedules]);

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getDateSchedules = (date: Date) => {
    const dateKey = date.toISOString().split("T")[0];
    return schedulesByDate.get(dateKey) || [];
  };

  return (
    <div className="pm-calendar">
      <div className="calendar-controls">
        <button onClick={previousMonth} className="btn btn-sm btn-outline">
          &larr; Prev
        </button>
        <div className="calendar-title">
          <h2>
            {monthName} {year}
          </h2>
          <button onClick={goToToday} className="btn btn-sm btn-secondary">
            Today
          </button>
        </div>
        <button onClick={nextMonth} className="btn btn-sm btn-outline">
          Next &rarr;
        </button>
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}

        {calendarDays.map((date, index) => {
          const daySchedules = getDateSchedules(date);
          const isTodayDate = isToday(date);
          const inCurrentMonth = isCurrentMonth(date);

          return (
            <div
              key={index}
              className={`calendar-day${isTodayDate ? " today" : ""}${
                !inCurrentMonth ? " other-month" : ""
              }${daySchedules.length > 0 ? " has-schedules" : ""}`}
            >
              <div className="day-number">{date.getDate()}</div>

              {daySchedules.length > 0 && (
                <div className="day-schedules">
                  {daySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      className="schedule-event"
                      title={`${schedule.name}${schedule.asset ? ` - ${schedule.asset.name}` : ""}`}
                    >
                      <span className="event-dot">&bull;</span>
                      <span className="event-text">
                        {schedule.asset?.name || schedule.name}
                      </span>
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className="more-events">
                      +{daySchedules.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-dot today-dot"></div>
          <span>Today</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot schedule-dot"></div>
          <span>PM Scheduled</span>
        </div>
      </div>
    </div>
  );
}
