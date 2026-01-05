export const techRoutes = {
  home: () => "/tech",
  workOrder: (id: string) => `/tech/work-orders/${id}`,
  task: (id: string) => `/tech/tasks/${id}`,
  visit: (id: string) => `/tech/visits/${id}`,
} as const;
