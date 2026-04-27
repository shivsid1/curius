// Page/limit caps for all paginated API endpoints. Caps the maximum data a
// single client can pull through brute-force pagination iteration -- combined
// with the rate limiter, makes scraping the full corpus expensive.
export const MAX_PAGE = 25;
export const MAX_LIMIT = 50;

export function clampPagination(
  searchParams: URLSearchParams,
  defaults: { defaultLimit: number }
) {
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') || String(defaults.defaultLimit), 10);
  const page = Math.min(Math.max(1, Number.isFinite(rawPage) ? rawPage : 1), MAX_PAGE);
  const limit = Math.min(Math.max(1, Number.isFinite(rawLimit) ? rawLimit : defaults.defaultLimit), MAX_LIMIT);
  return { page, limit };
}
