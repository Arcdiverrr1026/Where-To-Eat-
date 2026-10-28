const ErrorState = ({ message, retry }) => {
  return (
    <div className="notice error" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="text-button" onClick={retry}>
          重新加载
        </button>
      )}
    </div>
  );
};

export default ErrorState;
