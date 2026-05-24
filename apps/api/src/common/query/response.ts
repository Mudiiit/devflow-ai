export function formatPaginatedResponse<T>(items: T[], pagination: { page: number; pageSize: number; total: number }) {
  const totalPages = Math.ceil((pagination.total || 0) / pagination.pageSize);
  return {
    data: items,
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages,
    },
  };
}
