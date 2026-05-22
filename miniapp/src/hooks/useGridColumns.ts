import { useEffect, useState } from "react";

export function useGridColumns() {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const update = () => {
      if (window.matchMedia("(min-width: 1280px)").matches) {
        setColumns(3);
        return;
      }
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setColumns(2);
        return;
      }
      setColumns(1);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columns;
}
