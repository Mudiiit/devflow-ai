export const formatNumber = (value: number): string => value.toLocaleString();

export const formatPercent = (value: number): string => `${value.toFixed(0)}%`;

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) {
    return "-";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
};
