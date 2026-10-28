const EmptyState = ({ title, children, action }) => {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <div className="empty-copy">{children}</div>
      {action}
    </div>
  );
};

export default EmptyState;
