import { LoaderCircle } from "lucide-react";

const Loading = ({ label = "正在加载…" }) => {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={20} className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
};

export default Loading;
