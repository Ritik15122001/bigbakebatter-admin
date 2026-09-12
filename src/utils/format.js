export function money(n) {
  return '₹' + Number(Math.round(n)).toLocaleString('en-IN');
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDateShort(d) {
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}
