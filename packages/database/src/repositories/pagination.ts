export interface OffsetPaginationInput {
  page?: number;
  pageSize?: number;
}

export interface OffsetPaginationResult<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function normalizeOffsetPagination(input: OffsetPaginationInput = {}): Required<OffsetPaginationInput> {
  const page = Number.isFinite(input.page) && input.page && input.page > 0 ? Math.floor(input.page) : 1;
  const pageSize = Number.isFinite(input.pageSize) && input.pageSize && input.pageSize > 0 ? Math.floor(input.pageSize) : 25;

  return {
    page,
    pageSize,
  };
}

export function createOffsetPaginationResult<TItem>(
  items: TItem[],
  total: number,
  input: OffsetPaginationInput = {},
): OffsetPaginationResult<TItem> {
  const pagination = normalizeOffsetPagination(input);
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));

  return {
    items,
    total,
    totalPages,
    ...pagination,
  };
}