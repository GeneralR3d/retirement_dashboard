export const fmt = (n: number) =>
  n.toLocaleString("en-SG", { maximumFractionDigits: 0 });
export const fmtMoney = (n: number) => `$${fmt(n)}`;
