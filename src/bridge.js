const hasBridge = () =>
  typeof window !== "undefined" && typeof window.HylidBridge !== "undefined";

const safeCall = (fnName) => {
  if (!hasBridge()) return;
  const fn = window.HylidBridge?.[fnName];
  if (typeof fn === "function") {
    fn();
  }
};

const bridge = {
  isSuperQi: () => hasBridge(),
  ready: () => safeCall("ready"),
  close: () => safeCall("close"),
};

export default bridge;
