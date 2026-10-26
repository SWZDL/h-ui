import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

/**
 * Compatibility shim for links shaped like `#/redirect/account/list?focus=...`.
 * Replaces the current entry with the real destination.
 */
export function RedirectPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const suffix = params["*"] ?? "";
    navigate(`/${suffix}${location.search}`, { replace: true });
  }, [params, location.search, navigate]);

  return null;
}
