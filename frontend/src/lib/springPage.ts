interface SpringPageMetadata {
  size?: number;
  number?: number;
  totalElements?: number;
  totalPages?: number;
}

export interface SpringPageResponse<T> {
  content?: T[];
  page?: SpringPageMetadata;
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

export interface PaginatedResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export function normalizeSpringPage<T>(
  response: SpringPageResponse<T>,
  mapItem: (item: T) => T = (item) => item,
): PaginatedResult<T> {
  const content = response.content ?? [];
  const metadata = response.page ?? response;
  const size = metadata.size ?? content.length;
  const totalElements = metadata.totalElements ?? content.length;
  const totalPages =
    metadata.totalPages ??
    (totalElements === 0 ? 0 : Math.max(1, Math.ceil(totalElements / Math.max(size, 1))));

  return {
    content: content.map(mapItem),
    totalElements,
    totalPages,
    number: metadata.number ?? 0,
    size,
  };
}

export function buildPageQuery(page: number, size: number, sort: string) {
  return new URLSearchParams({
    page: String(page),
    size: String(size),
    sort,
  });
}
