import { useEffect, useState } from 'react';
import Icon from '../components/common/Icon';
import { categoryService } from '../services/catalogService';
import { productService } from '../services/productService';
import { useUiStore } from '../store/uiStore';

export default function CategoriesStock() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [categories, setCategories] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([categoryService.list(), productService.list()])
      .then(([cats, products]) => {
        setCategories(cats);
        setStock(products);
      })
      .catch((e) => pushToast({ title: 'Failed to load', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleActive = async (cat) => {
    try {
      await categoryService.update(cat._id, { active: !cat.active });
      setCategories((prev) => prev.map((c) => (c._id === cat._id ? { ...c, active: !c.active } : c)));
    } catch (e) {
      pushToast({ title: 'Could not update category', subtitle: e.message, kind: 'err' });
    }
  };

  const adjustQty = async (product, delta) => {
    try {
      const updated = await productService.adjustStock(product._id, delta);
      setStock((prev) => prev.map((p) => (p._id === product._id ? updated : p)));
    } catch (e) {
      pushToast({ title: 'Could not update stock', subtitle: e.message, kind: 'err' });
    }
  };

  if (loading) return <div className="a-panel a-empty"><p className="muted">Loading…</p></div>;

  return (
    <div className="a-grid-2">
      <div className="a-panel">
        <div className="a-panel-head">
          <h3>Categories</h3>
        </div>
        <div className="a-table-wrap">
          <table className="tbl tbl-mini">
            <thead>
              <tr><th>Category</th><th>Cakes</th><th>Active</th></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c._id}>
                  <td>
                    <span className="row gap-2 center">
                      <Icon name={c.icon} className="icon icon-sm" />
                      {c.name}
                    </span>
                  </td>
                  <td>{stock.filter((p) => p.cat === c.name).length}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <label className="check" style={{ display: 'inline-flex' }}>
                      <input type="checkbox" checked={c.active} onChange={() => toggleActive(c)} />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="a-panel">
        <div className="a-panel-head">
          <h3>Stock levels</h3>
        </div>
        <div className="a-table-wrap">
          <table className="tbl tbl-mini">
            <thead>
              <tr><th>Cake</th><th>Qty</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s._id}>
                  <td>
                    <span className="cell-main">{s.name}</span>
                    <span className="cell-sub">{s.cat}</span>
                  </td>
                  <td>{s.qty}</td>
                  <td>
                    <span className={`badge ${s.stock === 'Out of stock' ? 'err' : s.stock === 'Low stock' ? 'warn' : 'success'}`}>{s.stock}</span>
                  </td>
                  <td className="rowact">
                    <button className="iconbtn" aria-label="Decrease" onClick={() => adjustQty(s, -1)}>
                      <Icon name="minus" className="icon icon-sm" />
                    </button>
                    <button className="iconbtn" aria-label="Increase" onClick={() => adjustQty(s, 1)}>
                      <Icon name="plus" className="icon icon-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
