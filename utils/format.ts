export const formatCurrency = (
  val: number,
  decimals: number = 2
): string => {
  return val.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString();
};
