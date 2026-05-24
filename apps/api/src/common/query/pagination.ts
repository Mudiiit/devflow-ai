export interface PaginationInput {
  page?: string | number | undefined;
  pageSize?: string | number | undefined;
}

export interface PaginationResult {
  page: number;
  pageSize: number;
  offset: number;
}

export const parsePagination = (input: PaginationInput, defaults: { page: number; pageSize: number; maxPageSize: number }): PaginationResult => {
  const parsedPage = typeof input.page === 'string' ? Number(input.page) : input.page;
  const parsedPageSize = typeof input.pageSize === 'string' ? Number(input.pageSize) : input.pageSize;

  const page = Number.isFinite(parsedPage) && (parsedPage as number) > 0 ? Math.floor(parsedPage as number) : defaults.page;
  const unclampedPageSize = Number.isFinite(parsedPageSize) && (parsedPageSize as number) > 0
    ? Math.floor(parsedPageSize as number)
    : defaults.pageSize;
  const pageSize = Math.min(defaults.maxPageSize, unclampedPageSize);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
};
