const Pagination = ({ page, total, pageSize, onChange }) => {
  if (total <= pageSize) return null;
  return (
    <nav className="pagination" aria-label="分页">
      <button
        className="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </button>
      <span>
        {page} / {Math.ceil(total / pageSize)}
      </span>
      <button
        className="secondary"
        disabled={page * pageSize >= total}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </button>
    </nav>
  );
};

export default Pagination;
