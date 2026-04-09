import type { Config } from "@react-router/dev/config";
import { joinUrlPath } from "@plane/utils";

const basePath = (() => {
  const resolved = joinUrlPath(process.env.VITE_SPACE_BASE_PATH ?? "", "/") ?? "/";
  return /^\/+$/.test(resolved) ? "/" : resolved;
})();

export default {
  appDirectory: "app",
  basename: basePath,
  ssr: true,
} satisfies Config;
