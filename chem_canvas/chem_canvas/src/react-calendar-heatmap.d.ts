declare module 'react-calendar-heatmap' {
  interface CalendarHeatmapProps {
    startDate: Date;
    endDate: Date;
    values: Array<{
      date: string;
      count: number;
    }>;
    classForValue?: (value: { date: string; count: number } | undefined) => string;
    tooltipDataAttrs?: (value: { date: string; count: number } | undefined) => Record<string, string>;
    showWeekdayLabels?: boolean;
  }

  const CalendarHeatmap: React.ComponentType<CalendarHeatmapProps>;
  export default CalendarHeatmap;
}