import { useEffect, useState } from "react";
import { api } from "../services/api.js";

const useResource = (path) => {
  const [state, setState] = useState({
    data: null,
    loading: Boolean(path),
    error: "",
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({ data: null, loading: true, error: "" });
    api(path, { signal: controller.signal })
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ data: null, loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [path, version]);
  return {
    ...state,
    reload: () => setVersion((v) => v + 1),
    setData: (data) => setState({ data, loading: false, error: "" }),
  };
};

export default useResource;
