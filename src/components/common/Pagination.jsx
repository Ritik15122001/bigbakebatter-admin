import Icon from './Icon';

/** Standard table pagination footer. Controlled: pass page/pageSize/total and onPage. */
export default function Pagination({ page, pageSize, total, onPage }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const pages = [];
  const add = (p) => { if (!pages.includes(p) && p >= 1 && p <= pageCount) pages.push(p); };
  add(1); add(page - 1); add(page); add(page + 1); add(pageCount);
  const sorted = pages.sort((a, b) => a - b);

  return (
    <div className="a-pagination">
      <span className="a-pagination-count">{from}&ndash;{to} of {total}</span>
      <div className="a-pagination-nav">
        <button className="iconbtn" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon name="cleft" className="icon icon-sm" />
        </button>
        {sorted.map((p, i) => (
          <span key={p} className="row">
            {i > 0 && p - sorted[i - 1] > 1 && <span className="a-pagination-ellipsis">&hellip;</span>}
            <button className={`a-pagination-page ${p === page ? 'on' : ''}`} onClick={() => onPage(p)}>{p}</button>
          </span>
        ))}
        <button className="iconbtn" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          <Icon name="cright" className="icon icon-sm" />
        </button>
      </div>
    </div>
  );
}
