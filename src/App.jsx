import React, { useEffect, useMemo, useState } from "react";
import bridge from "./bridge";
import { styles, theme } from "./styles";
import "./App.css";

/*
  Send token to MiniApps auth endpoint to validate Super Qi user
*/
async function authWithSuperQi(token) {
  const response = await fetch(
    "http://server.mouamle.space:19990/api/auth-with-superQi",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Auth failed: ${response.status} ${text}`);
  }

  return response.json();
}

const STORAGE_KEY = "family-living-calculator";

const defaultChild = () => ({
  age: "",
  type: "infant",
  doctor: "",
  milk: "",
  diapers: "",
  school: "",
  transport: "",
  daily: "",
  stationery: "",
});

const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0
  );

export default function App() {
  const [form, setForm] = useState({
    salary: "",
    wives: "0",
    childrenCount: "0",
    children: [],
    food: "",
    services: "",
    car: "no",
    taxi: "no",
    taxiIncome: "",
  });
  const [insideSuperQi, setInsideSuperQi] = useState(false);
  const [accordion, setAccordion] = useState({
    family: true,
    children: true,
    transport: true,
    general: true,
    summary: true,
  });
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed }));
      } catch (_) {
        /* ignore corrupted storage */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (bridge.isSuperQi()) {
      setInsideSuperQi(true);
      bridge.ready();

      (async () => {
        try {
          const token = window?.HylidBridge?.getAuthToken?.();
          if (!token) {
            console.warn("Super Qi bridge present but no auth token available");
            return;
          }

          const result = await authWithSuperQi(token);
          console.log("SuperQi auth result:", result);
          setAuthUser(result.user || result);
        } catch (err) {
          console.error("SuperQi auth error:", err);
          setAuthError(err.message || String(err));
        }
      })();
    }
  }, []);

  const handleMyLogin = () => {
    if (typeof window?.my?.getAuthCode !== "function") {
      setAuthError("Platform auth not available");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    window.my.getAuthCode({
      scopes: ["auth_base"],
      success: async (res) => {
        try {
          const token = res?.authCode || res?.auth_code || res?.token || "";
          const result = await authWithSuperQi(token);
          setAuthUser(result.user || result);
        } catch (err) {
          setAuthError(err.message || String(err));
        } finally {
          setAuthLoading(false);
        }
      },
      fail: (res) => {
        setAuthLoading(false);
        setAuthError(res?.authErrorScopes ? JSON.stringify(res.authErrorScopes) : JSON.stringify(res));
        console.log(res.authErrorScopes);
      },
    });
  };

  useEffect(() => {
    const count = Math.max(0, Number(form.childrenCount) || 0);
    setForm((prev) => {
      const current = prev.children.length;
      if (current === count) return prev;
      const next = [...prev.children];
      if (current < count) {
        for (let i = current; i < count; i += 1) next.push(defaultChild());
      } else {
        next.length = count;
      }
      return { ...prev, children: next };
    });
  }, [form.childrenCount]);

  const totals = useMemo(() => {
    const childExpenses = form.children.reduce((sum, child) => {
      if (child.type === "infant") {
        return (
          sum +
          toNumber(child.doctor) +
          toNumber(child.milk) +
          toNumber(child.diapers)
        );
      }
      return (
        sum +
        toNumber(child.school) +
        toNumber(child.transport) +
        toNumber(child.stationery) +
        toNumber(child.daily) * 30
      );
    }, 0);

    const general = toNumber(form.food) + toNumber(form.services);
    const taxiIncome =
      form.car === "yes" && form.taxi === "yes" ? toNumber(form.taxiIncome) : 0;
    const totalIncome = toNumber(form.salary) + taxiIncome;
    const totalExpenses = general + childExpenses;
    const balance = totalIncome - totalExpenses;

    return { childExpenses, general, taxiIncome, totalIncome, totalExpenses, balance };
  }, [form]);

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleChildChange = (index, key, value) => {
    setForm((prev) => {
      const updated = [...prev.children];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, children: updated };
    });
  };

  const toggleAccordion = (key) => {
    setAccordion((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.headerCard}>
          <div>
            <p style={styles.miniLabel}>Mini App • Super Qi</p>
            <h1 style={styles.title}>حاسبة المعيشة العائلية</h1>
            <p style={styles.subtitle}>
              تقدير شهري واقعي للعائلة العراقية • يعمل بدون اتصال • حفظ محلي تلقائي.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div style={styles.envBadge}>{insideSuperQi ? "داخل Super Qi" : "وضع المتصفح"}</div>
            {authUser ? (
              <div style={{ fontSize: 13, fontWeight: 700 }}>مرحباً {authUser.name || authUser.displayName || "مستخدم"}</div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleMyLogin}
                  style={{ ...styles.chip, padding: "6px 10px" }}
                  disabled={authLoading}
                >
                  {authLoading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
                </button>
              </div>
            )}
            {authError && <div style={{ color: "#b91c1c", fontSize: 12 }}>{authError}</div>}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.miniLabel}>البيانات الأساسية</p>
              <h3 style={styles.blockTitle}>معلومات العائلة</h3>
            </div>
            <button
              type="button"
              onClick={() => toggleAccordion("family")}
              style={styles.chip}
            >
              {accordion.family ? "إخفاء" : "عرض"}
            </button>
          </div>
          {accordion.family && (
            <>
              <div>
                <label style={styles.label}>الراتب الشهري (دينار عراقي)</label>
                <div style={styles.inputShell}>
                  <span style={styles.inputPrefix}>IQD</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="مثال: 1200000"
                    value={form.salary}
                    onChange={handleChange("salary")}
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={styles.label}>عدد الزوجات</label>
                <div style={styles.inputShell}>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.wives}
                    onChange={handleChange("wives")}
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={styles.label}>عدد الأطفال</label>
                <div style={styles.inputShell}>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.childrenCount}
                    onChange={handleChange("childrenCount")}
                    style={styles.input}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.miniLabel}>تفاصيل الأطفال</p>
              <h3 style={styles.blockTitle}>مصاريف الأبناء</h3>
            </div>
            <button
              type="button"
              onClick={() => toggleAccordion("children")}
              style={styles.chip}
            >
              {accordion.children ? "إخفاء" : "عرض"}
            </button>
          </div>
          {accordion.children && (
            <div style={{ display: "grid", gap: 12 }}>
              {form.children.length === 0 && (
                <div style={styles.empty}>لا يوجد أطفال حالياً.</div>
              )}
              {form.children.map((child, index) => (
                <div key={index} style={styles.listItem}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 800 }}>طفل #{index + 1}</div>
                    <div style={styles.chip}>
                      {child.type === "infant" ? "رضيع" : "طالب"}
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={styles.label}>العمر (بالسنوات)</label>
                    <div style={styles.inputShell}>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={child.age}
                        onChange={(e) =>
                          handleChildChange(index, "age", e.target.value)
                        }
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={styles.label}>الفئة</label>
                    <div style={styles.chipGroup}>
                      {[
                        { key: "infant", label: "رضيع (< سنتين)" },
                        { key: "student", label: "طفل / طالب" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            handleChildChange(index, "type", item.key)
                          }
                          style={{
                            ...styles.chip,
                            ...(child.type === item.key ? styles.chipActive : {}),
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {child.type === "infant" ? (
                    <>
                      <Field
                        label="كلفة الطبيب شهرياً"
                        value={child.doctor}
                        onChange={(v) => handleChildChange(index, "doctor", v)}
                      />
                      <Field
                        label="كلفة الحليب"
                        value={child.milk}
                        onChange={(v) => handleChildChange(index, "milk", v)}
                      />
                      <Field
                        label="كلفة الحفاضات"
                        value={child.diapers}
                        onChange={(v) =>
                          handleChildChange(index, "diapers", v)
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Field
                        label="كلفة المدرسة شهرياً"
                        value={child.school}
                        onChange={(v) => handleChildChange(index, "school", v)}
                      />
                      <Field
                        label="كلفة النقل شهرياً"
                        value={child.transport}
                        onChange={(v) =>
                          handleChildChange(index, "transport", v)
                        }
                      />
                      <Field
                        label="المصروف اليومي (يُحسب شهرياً)"
                        value={child.daily}
                        onChange={(v) => handleChildChange(index, "daily", v)}
                      />
                      <Field
                        label="القرطاسية (شهري)"
                        value={child.stationery}
                        onChange={(v) =>
                          handleChildChange(index, "stationery", v)
                        }
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.miniLabel}>التنقل والعمل</p>
              <h3 style={styles.blockTitle}>النقل والعمل بالتكسي</h3>
            </div>
            <button
              type="button"
              onClick={() => toggleAccordion("transport")}
              style={styles.chip}
            >
              {accordion.transport ? "إخفاء" : "عرض"}
            </button>
          </div>
          {accordion.transport && (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={styles.label}>هل تمتلك سيارة؟</label>
                <div style={styles.chipGroup}>
                  {[
                    { key: "yes", label: "نعم" },
                    { key: "no", label: "لا" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleChange("car")({ target: { value: item.key } })}
                      style={{
                        ...styles.chip,
                        ...(form.car === item.key ? styles.chipActive : {}),
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.car === "yes" && (
                <>
                  <div>
                    <label style={styles.label}>هل تعمل بها تكسي؟</label>
                    <div style={styles.chipGroup}>
                      {[
                        { key: "yes", label: "نعم" },
                        { key: "no", label: "لا" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            handleChange("taxi")({ target: { value: item.key } })
                          }
                          style={{
                            ...styles.chip,
                            ...(form.taxi === item.key ? styles.chipActive : {}),
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.taxi === "yes" && (
                    <Field
                      label="الوارد الشهري من التكسي"
                      value={form.taxiIncome}
                      onChange={(v) => handleChange("taxiIncome")({ target: { value: v } })}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.miniLabel}>مصاريف عامة</p>
              <h3 style={styles.blockTitle}>الأكل والخدمات</h3>
            </div>
            <button
              type="button"
              onClick={() => toggleAccordion("general")}
              style={styles.chip}
            >
              {accordion.general ? "إخفاء" : "عرض"}
            </button>
          </div>
          {accordion.general && (
            <div style={{ display: "grid", gap: 10 }}>
              <Field
                label="مصروف الأكل (شهري)"
                value={form.food}
                onChange={(v) => handleChange("food")({ target: { value: v } })}
              />
              <Field
                label="الخدمات (كهرباء، ماء، مولدة، إنترنت)"
                value={form.services}
                onChange={(v) =>
                  handleChange("services")({ target: { value: v } })
                }
              />
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.miniLabel}>النتيجة</p>
              <h3 style={styles.blockTitle}>ملخص الوارد والمصروف</h3>
            </div>
            <button
              type="button"
              onClick={() => toggleAccordion("summary")}
              style={styles.chip}
            >
              {accordion.summary ? "إخفاء" : "عرض"}
            </button>
          </div>
          {accordion.summary && (
            <>
              <SummaryRow label="إجمالي الوارد" value={totals.totalIncome} />
              <SummaryRow
                label="إجمالي المصروف"
                value={totals.totalExpenses}
                color="#b91c1c"
              />
              <SummaryRow
                label={totals.balance >= 0 ? "المتبقي" : "العجز"}
                value={Math.abs(totals.balance)}
                color={totals.balance >= 0 ? "#0f766e" : "#b91c1c"}
              />
              <div style={{ ...styles.listItem, marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>تفاصيل سريعة</div>
                <div style={styles.rowTop}>
                  <span>مصاريف الأطفال</span>
                  <strong>{formatCurrency(totals.childExpenses)} د.ع</strong>
                </div>
                <div style={styles.rowTop}>
                  <span>الخدمات + الأكل</span>
                  <strong>{formatCurrency(totals.general)} د.ع</strong>
                </div>
                {totals.taxiIncome > 0 && (
                  <div style={styles.rowTop}>
                    <span>وارد التكسي</span>
                    <strong style={{ color: theme.colors.accent }}>
                      {formatCurrency(totals.taxiIncome)} د.ع
                    </strong>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {insideSuperQi && (
          <button style={styles.closeBtn} onClick={bridge.close}>
            إغلاق الميني آب
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <div style={styles.inputShell}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div style={styles.summaryRow}>
      <div style={{ ...styles.pill, background: color || styles.pill.background }}>
        {label}
      </div>
      <div style={styles.rowValue}>{formatCurrency(value)} د.ع</div>
    </div>
  );
}
